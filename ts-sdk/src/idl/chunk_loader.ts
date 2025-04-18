/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/chunk_loader.json`.
 */
export type ChunkLoader = {
  "address": "ChUnQ7H46X5UeQJHVgZFBy3hGM95TwWsmvBRwQxVz3JG";
  "metadata": {
    "name": "chunkLoader";
    "version": "0.1.0";
    "spec": "0.1.0";
    "description": "Utility Solana program to send instruction data by chunks";
  };
  "instructions": [
    {
      "name": "closeChunks";
      "discriminator": [
        3,
      ];
      "accounts": [
        {
          "name": "owner";
          "writable": true;
          "signer": true;
          "relations": [
            "chunkHolder",
          ];
        },
        {
          "name": "chunkHolder";
          "writable": true;
        },
      ];
      "args": [];
    },
    {
      "name": "loadChunk";
      "discriminator": [
        1,
      ];
      "accounts": [
        {
          "name": "owner";
          "writable": true;
          "signer": true;
        },
        {
          "name": "chunkHolder";
          "writable": true;
          "pda": {
            "seeds": [
              {
                "kind": "const";
                "value": [
                  67,
                  72,
                  85,
                  78,
                  75,
                  95,
                  72,
                  79,
                  76,
                  68,
                  69,
                  82,
                ];
              },
              {
                "kind": "account";
                "path": "owner";
              },
              {
                "kind": "arg";
                "path": "chunkHolderId";
              },
            ];
          };
        },
        {
          "name": "systemProgram";
          "address": "11111111111111111111111111111111";
        },
      ];
      "args": [
        {
          "name": "chunkHolderId";
          "type": "u32";
        },
        {
          "name": "chunk";
          "type": {
            "defined": {
              "name": "chunk";
            };
          };
        },
      ];
    },
    {
      "name": "passToCpi";
      "discriminator": [
        2,
      ];
      "accounts": [
        {
          "name": "owner";
          "writable": true;
          "signer": true;
          "relations": [
            "chunkHolder",
          ];
        },
        {
          "name": "chunkHolder";
          "writable": true;
        },
        {
          "name": "program";
        },
      ];
      "args": [];
    },
  ];
  "accounts": [
    {
      "name": "chunkHolder";
      "discriminator": [
        1,
      ];
    },
  ];
  "types": [
    {
      "name": "chunk";
      "type": {
        "kind": "struct";
        "fields": [
          {
            "name": "index";
            "type": "u8";
          },
          {
            "name": "data";
            "type": "bytes";
          },
        ];
      };
    },
    {
      "name": "chunkHolder";
      "type": {
        "kind": "struct";
        "fields": [
          {
            "name": "owner";
            "type": "pubkey";
          },
          {
            "name": "chunks";
            "type": {
              "vec": {
                "defined": {
                  "name": "chunk";
                };
              };
            };
          },
        ];
      };
    },
  ];
};
