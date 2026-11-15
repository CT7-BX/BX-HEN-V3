#include <assert.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>

#include "../probe_contract.h"

int main(int argc, char **argv)
{
    const char good[] = BX_REMOTE_PROBE_MARKER;
    const char wrong[] = "BX-REMOTE-PLAY/PS4-PROBE/2\n";
    char with_nul[sizeof(good) + 2];
    char from_file[128];
    FILE *f;
    size_t n;

    assert(bx_remote_probe_matches(good, sizeof(good) - 1));
    assert(!bx_remote_probe_matches(NULL, sizeof(good) - 1));
    assert(!bx_remote_probe_matches(good, 0));
    assert(!bx_remote_probe_matches(good, sizeof(good) - 2));
    assert(!bx_remote_probe_matches(wrong, sizeof(wrong) - 1));
    assert(!bx_remote_probe_matches(good, sizeof(good)));

    memset(with_nul, 0, sizeof(with_nul));
    memcpy(with_nul, good, sizeof(good) - 1);
    with_nul[sizeof(good)] = 'x';
    assert(!bx_remote_probe_matches(with_nul, sizeof(good) + 1));

    assert(argc == 2);
    f = fopen(argv[1], "rb");
    assert(f != NULL);
    n = fread(from_file, 1, sizeof(from_file), f);
    assert(!ferror(f));
    assert(feof(f) || n < sizeof(from_file));
    fclose(f);
    assert(bx_remote_probe_matches(from_file, n));

    puts("PS4 probe contract: all checks passed");
    return 0;
}
