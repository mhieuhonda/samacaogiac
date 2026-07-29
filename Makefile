# ============================================================
# Makefile — Standandalone build of the NDK audio library.
#
# This is a convenience wrapper around `ndk-build`/`cmake` so you
# can rebuild the native library from a shell without going through
# Gradle. Useful for iterating on C/C++ changes quickly.
#
# Usage:
#   make                # Build all ABIs into app/src/main/jniLibs/
#   make arm64          # Build only arm64-v8a
#   make clean          # Remove build outputs
#   make stats          # Print .so sizes
#
# Prerequisites:
#   - ANDROID_NDK_HOME must point to an NDK installation (>= r23).
#   - cmake >= 3.18 (bundled with NDK).
# ============================================================

NDK_HOME      ?= $(ANDROID_NDK_HOME)
NDK_BUILD     ?= $(NDK_HOME)/ndk-build
CMAKE         ?= cmake

# Default to the LTS NDK r26 if not set
ifeq ($(NDK_HOME),)
  $(error ANDROID_NDK_HOME is not set. Install NDK r23+ and export ANDROID_NDK_HOME.)
endif

APP_DIR       := app
CPP_DIR       := $(APP_DIR)/src/main/cpp
JNI_LIBS_DIR  := $(APP_DIR)/src/main/jniLibs
BUILD_DIR     := $(APP_DIR)/.cxx

# ABIs we ship. arm64-v8a is the modern default; armeabi-v7a covers
# legacy 32-bit devices (still ~10% of active Android in 2026).
ABIS          := arm64-v8a armeabi-v7a x86_64 x86

ANDROID_PLATFORM := android-24

.PHONY: all clean stats arm64 armv7 x86_64 x86 install

all: $(ABIS)

define build_abi
$(1): $(JNI_LIBS_DIR)/$(1)/libsamacaogiac_audio.so

$(JNI_LIBS_DIR)/$(1)/libsamacaogiac_audio.so: $(CPP_DIR)/CMakeLists.txt $(CPP_DIR)/native_audio.cpp $(CPP_DIR)/audio_mixer.c $(CPP_DIR)/audio_mixer.h $(CPP_DIR)/fast_math.h $(CPP_DIR)/fast_distance_arm.S
	@mkdir -p $(BUILD_DIR)/$(1)
	@echo "==> Building libsamacaogiac_audio.so for $(1)"
	cd $(BUILD_DIR)/$(1) && $(CMAKE) \
		-DCMAKE_TOOLCHAIN_FILE=$(NDK_HOME)/build/cmake/android.toolchain.cmake \
		-DANDROID_ABI=$(1) \
		-DANDROID_PLATFORM=$(ANDROID_PLATFORM) \
		-DCMAKE_BUILD_TYPE=Release \
		$(CURDIR)/$(CPP_DIR) >/dev/null
	$(CMAKE) --build $(BUILD_DIR)/$(1) -j 4 --target samacaogiac_audio
	@mkdir -p $(JNI_LIBS_DIR)/$(1)
	cp $(BUILD_DIR)/$(1)/libsamacaogiac_audio.so $(JNI_LIBS_DIR)/$(1)/
endef

$(foreach abi,$(ABIS),$(eval $(call build_abi,$(abi))))

arm64: arm64-v8a
armv7: armeabi-v7a
x86_64: x86_64
x86: x86

stats:
	@echo "=== Native library sizes ==="
	@for abi in $(ABIS); do \
	  so=$(JNI_LIBS_DIR)/$$abi/libsamacaogiac_audio.so; \
	  if [ -f "$$so" ]; then \
	    printf "%-15s %8d bytes\n" "$$abi" $$(stat -c %s "$$so"); \
	  else \
	    printf "%-15s (not built)\n" "$$abi"; \
	  fi; \
	done

clean:
	rm -rf $(BUILD_DIR) $(JNI_LIBS_DIR)
