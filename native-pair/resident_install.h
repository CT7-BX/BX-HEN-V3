#ifndef BX_RESIDENT_INSTALL_H
#define BX_RESIDENT_INSTALL_H
/* Copy the experimental ELF bundled in this PKG to GoldHEN LaunchPad's
 * payload directory. Opt-in only: does not launch or set AutoRun.
 * Return 1 on prepared and enabled, negative on error.
 */
int bx_resident_prepare(void);
#endif
