# Variables
ZIG=zig

# Default target: Build and run
all: build 

# Build the Zig codebase
build:
	$(ZIG) build --release=small

# Run the built executable
run:
	./zig-out/bin/fabric

runrel:
	./main

# Clean up the built executable
clean:
	rm -f $(OUT)

.PHONY: all build run clean
