import React from 'react';
import { styled, Provider } from 'styletron-react';
import { Client as Styletron } from 'styletron-engine-atomic';

const Table = styled('div', {
  display: 'table',
  marginTop: '10px',
});

const Row = styled('div', {
  display: 'table-row',
});

const Cell = styled('div', props => ({
  display: 'table-cell',
  padding: '10px',
  background: `rgba(74, 174, 53, ${props.value})`,
}));

const TableComponent = ({ table, toPercent }) => (
  <Table>
    {table.map((row, i) => (
      <Row key={i}>
        {row.map((x, j) => (
          <Cell key={`${i}${j}`} value={x}>
            {toPercent(x)}
          </Cell>
        ))}
      </Row>
    ))}
  </Table>
);

const styleSheet = document.createElement('style');
document.head.appendChild(styleSheet);

const engine = new Styletron([styleSheet]);

export default ({ table, toPercent }) => (
  <Provider styletron={engine}>
    <TableComponent table={table} toPercent={toPercent} />
  </Provider>
);
