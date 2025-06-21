const std = @import("std");
const Fabric = @import("fabric");
const Signal = Fabric.Signal;
const Static = Fabric.Static;
const Pure = Fabric.Pure;
const Style = Fabric.Style;
var counter: *Signal(u32) = undefined;
pub fn init() void {
    counter = Signal(u32).init(0);
    Fabric.Page(@src(), render, null, Style.apply(.{
        .width = .percent(1),
        .height = .percent(1),
        .direction = .column,
        .child_alignment = .{ .y = .center, .x = .start },
    }));
}

fn increment() void {
    counter.increment();
}

pub fn render() void {
    Static.FlexBox(.{
        .height = .percent(100),
        .width = .percent(100),
        .direction = .column,
        .child_gap = 16,
    })({
        Static.Svg(@embedFile("Logo.svg"), .{
            .width = .fixed(600),
        });
        Static.FlexBox(.{})({
            Static.Text("Rank ", .{
                .font_size = 32,
                .white_space = .pre,
            });
            Pure.AllocText("{d}", .{counter.get()}, .{
                .font_size = 32,
                .text_color = .hex("#6338FF"),
                .font_weight = 700,
            });
            Pure.Text("/10", .{
                .font_size = 32,
            });
        });
        Static.Button(
            Static.BtnProps{
                .onPress = increment,
            },
            Style.apply(.{
                .padding = .all(8),
                .border_thickness = .all(1),
                .width = .fixed(120),
                .height = .fixed(40),
            }),
        )({
            Static.Text("Increment", .{
                .font_size = 16,
            });
        });
    });
}
