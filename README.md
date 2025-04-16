# Chunk Loader

Chunk loader is a general-purpose Solana program that can be used to send
transactions in chunks when the arguments of an instruction don't fit into
a single transaction.

It works by first loading the data in a temporary account (`LoadChunk`), and
then calling the destination program with the data (`PassToCpi`). After that
the temporary account is closed to reclaim SOL.

The `LoadChunk` transactions can be sent in parallel, confirmed and then
followed by the `PassToCpi` transaction. So basically, no matter the size of
the data, it takes the same time as sending two transactions sequentially.

## Testing

```
anchor test --skip-local-validator --skip-deploy
```
