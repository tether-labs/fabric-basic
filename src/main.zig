const std = @import("std");
const fabric = @import("fabric");
const RootPage = @import("routes/Page.zig");
const TrackingAllocator = fabric.TrackingAllocator;
var fb: fabric.lib = undefined;

var initial: bool = true;
var allocator: std.mem.Allocator = undefined;
export fn deinit() void {
    fb.deinit();
}

export fn instantiate(window_width: i32, window_height: i32) void {
    fb.init(.{
        .screen_width = window_width,
        .screen_height = window_height,
        .allocator = &allocator,
    });
    RootPage.init();
}

export fn renderCommands(route_ptr: [*:0]u8) i32 {
    const route = std.mem.span(route_ptr);
    fabric.renderCycle(route);
    fabric.lib.allocator_global.free(route);
    return 0;
}

pub fn main() !void {
    fabric.Style.setDefault(fabric.Style.Opaque);
    allocator = std.heap.wasm_allocator;
}
