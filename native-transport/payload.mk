# GoldHEN/ELF-loader payload. The PKG launcher continues to use OpenOrbis.
ifndef PS4_PAYLOAD_SDK
$(error PS4_PAYLOAD_SDK must point to the payload SDK with pinned 13.52 CRT)
endif
include $(PS4_PAYLOAD_SDK)/toolchain/orbis.mk
.DEFAULT_GOAL := all
OUT := build/payload
CFLAGS += -std=gnu11 -Wall -Wextra -DBX_TRANSPORT_PS4 -Ibuild/compat
# Load HTTP before its modern SSL backend; never mix SSL1 context IDs with SSL2.
LDFLAGS += -lSceHttp -lSceSsl2
OBJECTS := $(OUT)/main.o $(OUT)/bridge.o $(OUT)/socket_adapter.o $(OUT)/pair_config.o $(OUT)/pair_protocol.o
all: bx-rp-transport.elf
build/compat/orbis/Net.h:
	@test -n "$(OO_PS4_TOOLCHAIN)"
	mkdir -p build/compat
	cp -R "$(OO_PS4_TOOLCHAIN)/include/orbis" build/compat/
$(OUT)/%.o: %.c bridge.h socket_adapter.h tls_roots.h | build/compat/orbis/Net.h
	mkdir -p $(OUT)
	$(CC) $(CFLAGS) -c $< -o $@
$(OUT)/pair_config.o: ../native-pair/pair_config.c | build/compat/orbis/Net.h
	mkdir -p $(OUT)
	$(CC) $(CFLAGS) -c $< -o $@
$(OUT)/pair_protocol.o: ../native-pair/pair_protocol.c | build/compat/orbis/Net.h
	mkdir -p $(OUT)
	$(CC) $(CFLAGS) -c $< -o $@
bx-rp-transport.elf: $(OBJECTS)
	$(CC) $(OBJECTS) -o $@ $(LDFLAGS)
