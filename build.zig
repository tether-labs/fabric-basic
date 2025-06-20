const std = @import("std");

// Basic minimal fabric build.zig setup
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{
        .default_target = .{ .cpu_arch = .wasm32, .os_tag = .wasi },
    });

    const optimize = b.standardOptimizeOption(.{
        .preferred_optimize_mode = .ReleaseSmall,
    });

    const fabric = b.dependency("fabric", .{
        .target = target,
        .optimize = optimize,
    });

    const fabric_module = fabric.module("fabric");

    fabric_module.addImport("fabric", fabric_module);

    // We will also create a module for our other entry point, 'main.zig'.
    const exe_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
        .imports = &.{.{ .name = "fabric", .module = fabric_module }},
    });

    const exe = b.addExecutable(.{
        .name = "fabric",
        .root_module = exe_mod,
    });

    exe.rdynamic = true;

    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);

    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);
}
