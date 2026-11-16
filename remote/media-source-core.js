/* BX-REMOTE-PLAY media ownership — prevents WHEP and P2P sessions from
 * clearing or replacing one another unexpectedly.
 * No capture, transfer, credentials or browser persistence here.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BXMediaSources = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const OWNERS = new Set(["whep", "p2p", "legacy"]);
  function createSwitcher({ onAttach = () => {}, onPreempt = () => {} } = {}) {
    let owner = null;
    function attach(stream, source = "legacy") {
      if (!OWNERS.has(source)) throw new TypeError("Unknown media source");
      if (stream === null) {
        /* A stale callback must never clear another session's stream. */
        if (owner !== source) return false;
        owner = null;
        onAttach(null, null);
        return true;
      }
      if (!stream || typeof stream !== "object")
        throw new TypeError("Media stream required");
      if (owner !== null && owner !== source) {
        const previous = owner;
        /* Transfer ownership before notifying the displaced receiver. Its
         * stop() handler can safely attempt release without clearing us.
         */
        owner = source;
        onPreempt(previous, source);
      } else owner = source;
      onAttach(stream, source);
      return true;
    }
    return Object.freeze({ attach, currentOwner: () => owner });
  }
  return Object.freeze({ createSwitcher });
});
