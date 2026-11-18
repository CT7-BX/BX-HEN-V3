# GoldHEN/ELF-loader payload. The PKG launcher continues to use OpenOrbis.
ifndef PS4_PAYLOAD_SDK
$(error PS4_PAYLOAD_SDK must point to the payload SDK with pinned 13.52 CRT)
endif
include $(PS4_PAYLOAD_SDK)/toolchain/orbis.mk
.DEFAULT_GOAL := all
ifeq ($(MODE),direct)
OUT := build/direct
TARGET := bx-rp-direct-v11.elf
MAIN := direct_main
RTC_DIR := build/direct/deps
CFLAGS += -O2 -I$(RTC_DIR)/include -I$(RTC_DIR)/vendor/mbedtls/include -DMBEDTLS_CONFIG_FILE='<c4f_mbedtls_config.h>'
EXTRA := $(OUT)/rtc_rtc.o $(OUT)/rtc_stun.o $(OUT)/rtc_sctp.o $(OUT)/rtc_runtime.o $(patsubst $(RTC_DIR)/vendor/mbedtls/library/%.c,$(OUT)/mbed/%.o,$(wildcard $(RTC_DIR)/vendor/mbedtls/library/*.c))
else ifeq ($(MODE),stream)
OUT := build/stream
TARGET := bx-rp-stream-v10.elf
MAIN := stream_main
EXTRA := $(OUT)/ws_client.o $(OUT)/stream_state.o
ifndef STREAM_CURL_DIR
$(error STREAM_CURL_DIR must point to the verified patched curl archive for v10)
endif
LDFLAGS += -L$(STREAM_CURL_DIR)
else
OUT := build/payload
TARGET := bx-rp-transport.elf
MAIN := main
EXTRA :=
endif
CFLAGS += -std=gnu11 -Wall -Wextra -DBX_TRANSPORT_PS4 -DBX_TRANSPORT_CURL -Ibuild/compat -I$(PS4_PAYLOAD_SDK)/target/user/homebrew/include
# Static verified TLS libraries; no native SCE HTTP/SSL imports.
LDFLAGS += -L$(PS4_PAYLOAD_SDK)/target/user/homebrew/lib -lcurl -lpsl -lssl -lcrypto -lzstd -lz -pthread
OBJECTS := $(OUT)/$(MAIN).o $(OUT)/https_client.o $(EXTRA) $(OUT)/bridge.o $(OUT)/socket_adapter.o $(OUT)/pair_config.o $(OUT)/pair_protocol.o
all: $(TARGET)
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
$(TARGET): $(OBJECTS)
	$(CC) $(OBJECTS) -o $@ $(LDFLAGS)

$(OUT)/rtc_%.o: $(RTC_DIR)/src/%.c
	mkdir -p $(OUT)
	$(CC) $(CFLAGS) -c $< -o $@
$(OUT)/rtc_runtime.o: direct/runtime.c
	mkdir -p $(OUT)
	$(CC) $(CFLAGS) -c $< -o $@
$(OUT)/mbed/%.o: $(RTC_DIR)/vendor/mbedtls/library/%.c
	mkdir -p $(OUT)/mbed
	$(CC) $(CFLAGS) -c $< -o $@
