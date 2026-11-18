# Native payload license

The BX native payload component, including `main.c`, `bridge.c`,
`socket_adapter.c`, their headers and the `native-pair/pair_config` and
`native-pair/pair_protocol` code linked into this payload, is distributed
under GNU GPL version 3 or (at your option) any later version.

The ps4-payload-sdk startup code is copyright John Törnblom and its contributors,
under GPL-3.0-or-later. Its notices are preserved; the CI artifact includes its
COPYING and corresponding source. Pinned build dependencies and commands are
recorded in `.github/workflows/native-transport.yml` and `payload.mk`.

This statement applies to the native payload component, not to unrelated BX-HEN
code or the rest of the repository. Chiaki WASM retains its upstream AGPL license.

The v07 experimental HTTPS candidate statically links payload PacBrew libraries. Exact versions, source URLs, hashes and license identifiers are in `tls-dependencies.json`; `tls-corresponding-source.tar.gz` includes their original source/license archives and pinned package recipes. The curl, Apache-2.0, MIT, BSD-3-Clause and Zlib notices apply to those respective components.
