const connect = require('connect');
const serveHandler = require('serve-handler');
const shell = require('shelljs');
const chalk = require('chalk');
const glob = require('glob');

const http = require('http');
const path = require('path');
const fs = require('fs');
const { argv } = require('yargs');

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

const packageJson = 'package.json';

const filterPackages = argv._.length ? argv._ : null;

run();

function launchChromeAndRunLighthouse(url, flags = {}, config) {
  return chromeLauncher.launch(flags).then(chrome => {
    flags.port = chrome.port;
    return lighthouse(url, flags, config).then(results =>
      chrome.kill().then(() => results.lhr)
    );
  });
}

function getPackageList() {
  const packageConfig = require('../../package.json');

  const packages = packageConfig.workspaces
    .filter(wkspc => wkspc.startsWith('packages/benchmarks/'))
    .map(wkspc => wkspc.replace('**/*', '**/package.json'))
    .map(wkspc => path.resolve(__dirname, '..', '..', wkspc))
    .reduce((filePathes, wkspc) => [].concat(filePathes, glob.sync(wkspc)), []);

  return packages
    .map(pckg => {
      // NOTE: use NODE_PATH env variable to prevent .. .. ..
      const { benchmarks, scripts } = require(pckg);

      if (!scripts || (scripts && !scripts.build)) {
        return undefined;
      }

      return Object.assign({}, benchmarks, {
        path: path.resolve(
          __dirname,
          '..',
          '..',
          pckg.replace('/package.json', '')
        ),
      });
    })
    .filter(info => Boolean(info) && Boolean(info.name))
    .filter(info => {
      return (
        !filterPackages ||
        filterPackages.some(
          filterPackage => info.name.indexOf(filterPackage) > -1
        )
      );
    });
}

function getAverageValue(arr) {
  let total = 0;
  for (let i = 0; i < arr.length; i++) {
    total += arr[i];
  }
  return total / arr.length;
}

async function runTestCase(url) {
  const flags = { maxWaitForLoad: 60000, interactive: true };

  const mountDuration = [];
  const rerenderDuration = [];

  let butch = true;

  for (let i = 0; i < 5; i++) {
    try {
      const currentRes = await launchChromeAndRunLighthouse(
        `${url}&butch=${butch}`,
        flags,
        { extends: 'lighthouse:default' }
      );

      const measures = currentRes.audits['user-timings'].details.items.filter(
        ({ timingType }) => timingType === 'Measure'
      );

      mountDuration.push(
        ...measures
          .filter(({ name }) => name === 'measureMount')
          .map(({ duration }) => duration)
      );
      rerenderDuration.push(
        ...measures
          .filter(({ name }) => name.startsWith('measureRerender'))
          .map(({ duration }) => duration)
      );
    } catch (err) {
      console.log(err);
      i--;
    }
  }
  return {
    mountDuration: getAverageValue(mountDuration),
    rerenderDuration: getAverageValue(rerenderDuration),
  };
}

function getIcon(value) {
  return value ? '+' : '-';
}

function format(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function arrayToTable(array, cols) {
  const nextLine = '\r\n';
  const nextCol = ' | ';

  let table = `## Results:${nextLine}*sorted by rerender time*${nextLine}${nextLine}`;

  table += cols.join(nextCol);
  table += nextLine;
  table += cols.map(() => ':---').join(nextCol);
  table += nextLine;

  array.forEach(item => {
    table +=
      [
        item.link ? `[${item.name}](${item.link})` : item.name,
        getIcon(item.useCSS),
        getIcon(item.useInlineStyles),
        format(item.mountDuration),
        format(item.rerenderDuration),
      ].join(nextCol) + nextLine;
  });

  return table;
}

function writeResults(res) {
  const sortRes = res.sort((a, b) => a.rerenderDuration - b.rerenderDuration);

  const table = arrayToTable(sortRes, [
    'Solution',
    'Use CSS',
    'Use Inline-Styles',
    'Mount Time (ms)',
    'Rerender time (ms)',
  ]);

  if (!filterPackages) {
    sortRes.map(res => {
      console.log('');
      console.log(`${chalk.green(res.name)}`);
      console.log(`  - Mount time: ${chalk.cyan(res.mountDuration)} ms`);
      console.log(`  - Renderer time: ${chalk.cyan(res.rerenderDuration)} ms`);
      console.log('');
    });

    fs.writeFileSync(__dirname + '/../../RESULT.md', table);

    console.log('');
    console.log('Saved into RESULT.md');
    console.log('');
  }
}

async function run() {
  let res = [];

  const port = 3000;
  const packages = getPackageList();

  shell.config.verbose = true;

  if (!packages.length) {
    console.log('There are no packages');
    return;
  }

  console.log('');
  if (filterPackages) {
    console.log(
      `${chalk.green('Run benchmark')} for ${filterPackages
        .map(n => chalk.cyan(n))
        .join(', ')} packages`
    );
    console.log(`  note that metrics will not be saved to RESULTS.md`);
  } else {
    console.log(
      `${chalk.green('Run benchmark')}. Found ${packages.length} packages`
    );
  }
  console.log('');

  for (let i = 0; i < packages.length; i++) {
    //for (let i = 15; i < 16; i++) {
    const packageInfo = packages[i];
    const currentPort = port + i;

    console.log('');
    console.log(
      `  (${i + 1}/${packages.length}) ${chalk.green(
        packageInfo.name
      )} at port ${currentPort}`
    );
    console.log('');

    if (!process.env.SKIP_BUILD) {
      console.log(`  ${chalk.cyan('prepre package build')}`);
      console.log('');
      shell.exec(`yarn --cwd ${packageInfo.path} install --silent`);
      shell.exec(`yarn --cwd ${packageInfo.path} run build`);

      console.log('');
      console.log(`  ${chalk.cyan('build completed')}`);
      console.log('');
    }

    const server = http
      .createServer((request, response) => {
        return serveHandler(request, response, {
          public: path.join(packageInfo.path, 'static'),
          cleanUrls: true,
        });
      })
      .listen(currentPort);

    const url = `http://localhost:${currentPort}?test=true`;

    console.log(`  run tests...`);
    const packageRes = await runTestCase(url);

    console.log('');
    console.log(`  ${chalk.green(packageInfo.name)}:`);
    console.log(`    - Rerender Duration: ${packageRes.rerenderDuration} ms`);
    console.log(`    - Mount Duration: ${packageRes.mountDuration} ms`);

    res.push({
      name: packageInfo.name,
      useInlineStyles: packageInfo.useInlineStyles || false,
      useCSS: packageInfo.useCSS || false,
      link: packageInfo.link,
      rerenderDuration: packageRes.rerenderDuration,
      mountDuration: packageRes.mountDuration,
    });
    server.close();
  }

  writeResults(res);
}
