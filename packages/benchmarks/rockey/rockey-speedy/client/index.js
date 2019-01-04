import ReactDOM from 'react-dom';
import React from 'react';
import App from 'benchmarks-utils';
import 'rockey-react/speedy';
import Table from './Table';

ReactDOM.render(<App table={Table} />, document.getElementById('root'));
