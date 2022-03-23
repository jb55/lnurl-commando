
# lnurl-commando

An lnurl server that fetches invoices over the lightning network via
lnsocket[^1] and commando[^2]

## Usage

```
usage: lnurl-commando --nodeid <nodeid>
                      --host <commando-host>
                      --rune <rune>
                      --callback <lnurl-callback>
                      --description <invoice-description>
                      --longDescription <invoice-long-description>
                      --thumbnail <png|jpg path>
                      --identifier <email, vecndor, etc>
```

Make sure that the rune is restricted to the `invoice` method:
 
    $ lightning-cli commando-rune restrictions=method=invoice

[^1]: https://github.com/jb55/lnsocket
[^2]: https://github.com/lightningd/plugins/tree/master/commando


