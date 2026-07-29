# ============================================================
# CMakeLists.txt — Native build for the samacaogiac audio mixer.
#
# Output: libsamacaogiac_audio.so
# ABIs:   armeabi-v7a, arm64-v8a, x86, x86_64
#
# The ARM assembly file (fast_distance_arm.S) is included ONLY
# for armeabi-v7a. On arm64-v8a we rely on the inline asm in
# fast_math.h, which emits vsqrt.f32 directly.
# ============================================================
cmake_minimum_required(VERSION 3.18.1)

project(samacaogiac_audio LANGUAGES C CXX ASM)

# ---- Build flags ----
set(CMAKE_C_STANDARD 99)
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Optimize for size + speed on release.
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    add_compile_options(-O2 -fvisibility=hidden -fomit-frame-pointer -ffast-math)
endif()

# ---- Library ----
add_library(samacaogiac_audio SHARED
    native_audio.cpp
    audio_mixer.c
)

# ARMv7 gets the dedicated assembly implementation.
if(ANDROID_ABI STREQUAL "armeabi-v7a")
    target_sources(samacaogiac_audio PRIVATE fast_distance_arm.S)
    target_compile_definitions(samacaogiac_audio PRIVATE SAMAC_USE_ARM_ASM=1)
endif()

# ---- Includes ----
target_include_directories(samacaogiac_audio PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

# ---- Libraries ----
# We only need liblog for __android_log_print.
find_library(log-lib log)

target_link_libraries(samacaogiac_audio
    ${log-lib}
)

# ---- Strip on release ----
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    add_custom_command(TARGET samacaogiac_audio POST_BUILD
        COMMAND ${CMAKE_STRIP} -g $<TARGET_FILE:samacaogiac_audio>
        COMMENT "Stripping debug symbols from libsamacaogiac_audio.so"
    )
endif()
