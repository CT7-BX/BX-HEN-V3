SDK := $(OO_PS4_TOOLCHAIN)
CC := clang
LD := ld.lld
OUT := build
CFLAGS := --target=x86_64-pc-freebsd12-elf -fPIC -funwind-tables -std=c11 -Wall -Wextra -DBX_TRANSPORT_PS4 -c -isysroot $(SDK) -isystem $(SDK)/include
OBJECTS := $(OUT)/main.o $(OUT)/bridge.o $(OUT)/socket_adapter.o $(OUT)/pair_config.o $(OUT)/pair_protocol.o
LIBS := -lc -lkernel -lSceNet -lSceSsl -lSceHttp
all: bx-rp-transport.elf
$(OUT)/%.o: %.c bridge.h socket_adapter.h
	@mkdir -p $(OUT)
	$(CC) $(CFLAGS) $< -o $@
$(OUT)/pair_config.o: ../native-pair/pair_config.c
	@mkdir -p $(OUT)
	$(CC) $(CFLAGS) $< -o $@
$(OUT)/pair_protocol.o: ../native-pair/pair_protocol.c
	@mkdir -p $(OUT)
	$(CC) $(CFLAGS) $< -o $@
bx-rp-transport.elf: $(OBJECTS)
	$(LD) $(OBJECTS) -o $@ -m elf_x86_64 -pie --script $(SDK)/link.x --eh-frame-hdr -L$(SDK)/lib $(LIBS) $(SDK)/lib/crt1.o
