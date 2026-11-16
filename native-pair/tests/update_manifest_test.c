#include "../update_manifest.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>

int main(void) {
    const char *good =
        "title_id=BRPM00001\n"
        "version=0.15\n"
        "sha256=108a6b92fc0aeffdb23e17d79e259a9f7b354b666cfab5c7116b1a22d27d8092\n"
        "pkg_url=https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/pair-test-v0.15/BX-REMOTE-PLAY-Pair-Test-v0.15.pkg\n";
    BXUpdateManifest m = {0};
    /* The parser accepts arbitrary key order but never a mismatched URL. */
    assert(bx_update_parse(
        "pkg_url=https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/pair-test-v0.15/BX-REMOTE-PLAY-Pair-Test-v0.15.pkg\n"
        "sha256=108a6b92fc0aeffdb23e17d79e259a9f7b354b666cfab5c7116b1a22d27d8092\n"
        "title_id=BRPM00001\nversion=0.15\n", &m));
    assert(bx_update_parse(good, &m));
    assert(!strcmp(m.version, "0.15"));
    assert(m.major == 0 && m.minor == 15);
    assert(bx_update_is_newer(&m, 0, 14));
    assert(!bx_update_is_newer(&m, 0, 15));
    assert(!bx_update_is_newer(&m, 1, 0));

    assert(!bx_update_parse(
        "title_id=WRONG0001\nversion=0.15\nsha256=108a6b92fc0aeffdb23e17d79e259a9f7b354b666cfab5c7116b1a22d27d8092\n"
        "pkg_url=https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/pair-test-v0.15/BX-REMOTE-PLAY-Pair-Test-v0.15.pkg\n", &m));

    assert(!bx_update_parse(
        "title_id=BRPM00001\nversion=0.15\nversion=0.16\nsha256=108a6b92fc0aeffdb23e17d79e259a9f7b354b666cfab5c7116b1a22d27d8092\n"
        "pkg_url=https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/pair-test-v0.15/BX-REMOTE-PLAY-Pair-Test-v0.15.pkg\n", &m));

    assert(!bx_update_parse(
        "title_id=BRPM00001\nversion=0.15\nsha256=108a6b92fc0aeffdb23e17d79e259a9f7b354b666cfab5c7116b1a22d27d8092\n"
        "pkg_url=https://another-site.invalid/fake.pkg\n", &m));

    assert(!bx_update_parse(
        "title_id=BRPM00001\nversion=0.15\nsha256=108a6b92fc0aeffdb23e17d79e259a9f7b354b666cfab5c7116b1a22d27d8092\n"
        "pkg_url=https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/pair-test-v0.15/BX-REMOTE-PLAY-Pair-Test-v0.15.pkg?key=abc\n", &m));

    assert(!bx_update_parse(
        "title_id=BRPM00001\nversion=0.15\nsha256=108a6b92fc0aeffdb23e17d79e259a9f7b354b666cfab5c7116b1a22d27d8092\n", &m));

    /* Reject cross-version release URLs even when the host and suffix are valid. */
    assert(!bx_update_parse(
        "title_id=BRPM00001\nversion=0.15\nsha256=108a6b92fc0aeffdb23e17d79e259a9f7b354b666cfab5c7116b1a22d27d8092\n"
        "pkg_url=https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/pair-test-v0.16/BX-REMOTE-PLAY-Pair-Test-v0.16.pkg\n", &m));

    assert(!bx_update_parse(
        "title_id=BRPM00001\nversion=0.15\nsha256=108a6b92fc0aeffdb23e17d79e259a9f7b354b666cfab5c7116b1a22d27d8092\n"
        "pkg_url=https://github.com/CT7-BX/BX-REMOTE-PLAY/releases/download/pair-test-v0.15/BX-REMOTE-PLAY-Pair-Test-v0.16.pkg\n", &m));

    printf("Update manifest parser and numeric comparison verified.\n");
    return 0;
}
