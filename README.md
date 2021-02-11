# Paisu
Paisu is a CLI tool for converting transaction history on the Ethereum network to beancount format text file.

## Usage

```shell
$ paisu --config config.yml -o file.bean
```

## Config File

* addresses: address of accounts on ethereum
* baseCurrency: base currency to calculate costs
* startBlock: start block to scan the transactions
