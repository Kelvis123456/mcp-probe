# MCP probe report

| Result | Check | ms | Detail |
| --- | --- | ---: | --- |
| pass | initialize handshake | 475 |  |
| pass | tools/list answers | 22 |  |
| pass | every tool has a description and an object input schema | 0 |  |
| pass | required tools exist (echo, get-sum, get-structured-content) | 0 |  |
| pass | unknown tool is rejected, not ignored | 4 |  |
| pass | call: echo returns the message | 4 |  |
| pass | call: get-sum adds two numbers | 3 |  |
| pass | call: get-sum rejects a string for a number | 2 |  |
| pass | call: echo without its required argument fails | 1 |  |
| pass | call: get-structured-content rejects an unknown location | 2 |  |
| pass | server still responds after all calls | 2 |  |
