# Experimental pairing PROOF; independent from ps4-agent diagnostic PKG.
SDK := $(OO_PS4_TOOLCHAIN)
HOST_OS := $(shell uname -s)
PLATFORM := $(if $(filter Darwin,$(HOST_OS)),macos,linux)
PS4_CC ?= clang
PS4_LD ?= ld.lld

PS4_ID := BRPM00001
CONTENT_ID := IV0000-BRPM00001_00-BXREMOTEPAIR0001
VERSION := 0.13
OUT := build
OBJECTS := $(OUT)/main.o $(OUT)/pair_protocol.o $(OUT)/pair_config.o
LIBS := -lc -lkernel -lSceNet -lSceSsl -lSceHttp -lSceSysmodule -lSceSysUtil -lScePad -lSceUserService

CFLAGS := --target=x86_64-pc-freebsd12-elf -fPIC -funwind-tables \
    -std=c11 -Wall -Wextra -c -isysroot $(SDK) -isystem $(SDK)/include
LDFLAGS := -m elf_x86_64 -pie --script $(SDK)/link.x \
    --eh-frame-hdr -L$(SDK)/lib $(LIBS) $(SDK)/lib/crt1.o

.PHONY: all eboot pkg check-sdk check-assets clean
all: eboot
eboot: eboot.bin

check-sdk:
	@test -n "$(OO_PS4_TOOLCHAIN)" && test -f "$(SDK)/link.x" || \
	  (echo "Configure OO_PS4_TOOLCHAIN com o OpenOrbis instalado." >&2; exit 1)
	@command -v $(PS4_CC) >/dev/null && command -v $(PS4_LD) >/dev/null

$(OUT)/%.o: %.c pair_protocol.h pair_config.h | check-sdk
	@mkdir -p $(OUT)
	$(PS4_CC) $(CFLAGS) -o $@ $<

$(OUT)/bx_pair_proof.elf: $(OBJECTS) | check-sdk
	$(PS4_LD) $(OBJECTS) -o $@ $(LDFLAGS)

eboot.bin: $(OUT)/bx_pair_proof.elf
	"$(SDK)/bin/$(PLATFORM)/create-fself" -in=$< \
	  -out=$(OUT)/bx_pair_proof.oelf --eboot "$@" --paid 0x3800000000000011

check-assets:
	@for path in sce_sys/about/right.sprx sce_sys/icon0.png \
	  sce_module/libSceFios2.prx sce_module/libc.prx; do \
	  test -f "$$path" || { echo "Faltando $$path (ver README.md)" >&2; exit 1; }; \
	done

sce_sys/param.sfo: | check-sdk
	@mkdir -p sce_sys
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_new $@
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ APP_TYPE --type Integer --maxsize 4 --value 1
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ APP_VER --type Utf8 --maxsize 8 --value '$(VERSION)'
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ ATTRIBUTE --type Integer --maxsize 4 --value 0
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ CATEGORY --type Utf8 --maxsize 4 --value 'gd'
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ CONTENT_ID --type Utf8 --maxsize 48 --value '$(CONTENT_ID)'
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ DOWNLOAD_DATA_SIZE --type Integer --maxsize 4 --value 0
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ SYSTEM_VER --type Integer --maxsize 4 --value 0
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ TITLE --type Utf8 --maxsize 128 --value 'BX Remote Play - Pair Test'
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ TITLE_ID --type Utf8 --maxsize 12 --value '$(PS4_ID)'
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" sfo_setentry $@ VERSION --type Utf8 --maxsize 8 --value '$(VERSION)'

pkg: eboot.bin sce_sys/param.sfo check-assets
	"$(SDK)/bin/$(PLATFORM)/create-gp4" -out pkg.gp4 \
	  --content-id=$(CONTENT_ID) \
	  --files "eboot.bin sce_sys/param.sfo sce_sys/icon0.png sce_sys/about/right.sprx sce_module/libc.prx sce_module/libSceFios2.prx"
	"$(SDK)/bin/$(PLATFORM)/PkgTool.Core" pkg_build pkg.gp4 .

clean:
	rm -rf $(OUT) eboot.bin pkg.gp4 sce_sys/param.sfo "$(CONTENT_ID).pkg"
