import React from 'react';
import { styled } from 'linaria/react';

const Table = styled.div`
  display: table;
  margin-top: 10px;
`;

const Row = styled.div`
  display: table-row;
`;

const Cell = styled.div`
  display: table-cell;
  padding: 10px;
`;

export default ({ table, toPercent }) => (
  <Table>
    {table.map((row, i) => (
      <Row key={i}>
        {row.map((x, j) => (
          <Cell
            key={`${i}${j}`}
            style={{ background: `rgba(74, 174, 53, ${x})` }}
          >
            {toPercent(x)}
          </Cell>
        ))}
      </Row>
    ))}
  </Table>
);
