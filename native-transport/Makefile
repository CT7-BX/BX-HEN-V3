SDK := $(OO_PS4_TOOLCHAIN)
CC := clang
LD := ld.lld
OUT := build
CFLAGS := --target=x86_64-pc-freebsd12-elf -fPIC -funwind-tables -std=c11 -Wall -Wextra -DBX_TRANSPORT_PS4 -c -isysroot $(SDK) -isystem $(SDK)/include
OBJECTS := $(OUT)/main.o $(OUT)/bridge.o $(OUT)/socket_adapter.o $(OUT)/pair_config.o $(OUT)/pair_protocol.o
LIBS := -lc -lkernel -lSceNet -lSceSsl -lSceHttp
all: bx-rp-transport.elf
$(OUT)/%.o: %.c bridge.h socket_adapter.h account_id.h
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
PLATFORM := $(if $(filter Darwin,$(shell uname -s)),macos,linux)
CONTENT_ID := IV0000-BRPM00002_00-BXNATIVESTREAM01
$(OUT)/launcher.elf: $(OUT)/launcher.o $(OUT)/account_id.o
	$(LD) $^ -o $@ -m elf_x86_64 -pie --script $(SDK)/link.x --eh-frame-hdr -L$(SDK)/lib -lc -lkernel -lSceSysUtil -lSceUserService $(SDK)/lib/crt1.o
eboot.bin: $(OUT)/launcher.elf
	"$(SDK)/bin/$(PLATFORM)/create-fself" -in=$< -out=$(OUT)/launcher.oelf --eboot $@ --paid 0x3800000000000011
sce_sys/param.sfo:
	@mkdir -p sce_sys
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_new $@
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ APP_TYPE --type Integer --maxsize 4 --value 1
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ APP_VER --type Utf8 --maxsize 8 --value '0.01'
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ ATTRIBUTE --type Integer --maxsize 4 --value 0
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ CATEGORY --type Utf8 --maxsize 4 --value 'gd'
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ CONTENT_ID --type Utf8 --maxsize 48 --value '$(CONTENT_ID)'
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ DOWNLOAD_DATA_SIZE --type Integer --maxsize 4 --value 0
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ SYSTEM_VER --type Integer --maxsize 4 --value 0
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ TITLE --type Utf8 --maxsize 128 --value 'BX Native - Remote Play Transport'
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ TITLE_ID --type Utf8 --maxsize 12 --value 'BRPM00002'
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ VERSION --type Utf8 --maxsize 8 --value '0.01'
pkg: eboot.bin bx-rp-transport.elf sce_sys/param.sfo
	"$(SDK)/bin/$(PLATFORM)/create-gp4" -out pkg.gp4 --content-id=$(CONTENT_ID) --files "eboot.bin bx-rp-transport.elf sce_sys/param.sfo sce_sys/icon0.png sce_sys/about/right.sprx sce_module/libc.prx sce_module/libSceFios2.prx"
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" pkg_build pkg.gp4 .
