// zig-dev.zig
const std = @import("std");
const fs = std.fs;
const process = std.process;
const time = std.time;
const heap = std.heap;
const log = std.log;

const color = "\x1b[35m"; // ANSI escape code for red color
const background = "\x1b[36m"; // ANSI escape code for red color
const bold = "\x1b[1m"; // ANSI escape code to reset color
const bright_black = "\x1b[90m"; // Bright black (gray)
const bright_red = "\x1b[91m"; // Bright red
const bright_green = "\x1b[92m"; // Bright green
const bright_yellow = "\x1b[93m"; // Bright yellow
const bright_blue = "\x1b[94m"; // Bright blue
const bright_magenta = "\x1b[95m"; // Bright magenta
const bright_cyan = "\x1b[96m"; // Bright cyan
const bright_white = "\x1b[97m"; // Bright white
const reset = "\x1b[0m"; // Reset all formatting
const black = "\x1b[30m"; // Black text
const red = "\x1b[31m"; // Red text
const green = "\x1b[32m"; // Green text
const yellow = "\x1b[33m"; // Yellow text
const blue = "\x1b[34m"; // Blue text
const magenta = "\x1b[35m"; // Magenta text
const cyan = "\x1b[36m"; // Cyan text
const white = "\x1b[37m"; // White text

pub const Config = struct {
    watch_paths: []const []const u8 = &.{"src"}, // Directories to watch:set noreadonly
    build_command: []const []const u8 = &.{ "zig", "build" }, // Default build command
    make_command: []const []const u8 = &.{"make"}, // Default build command
    run_dev_command: []const []const u8 = &.{ "zig", "run", "src/main.zig" },
    run_command: []const []const u8 = &.{"zig-out/bin/app"}, // Default run command
    file_extensions: []const []const u8 = &.{ ".zig", ".html" }, // File extensions to watch
    exclude_dirs: []const []const u8 = &.{ "zig-cache", "zig-out" }, // Directories to ignore
    debounce_ms: u64 = 100,
};

const WatchContext = struct {
    allocator: std.mem.Allocator,
    config: Config,
    last_mod_times: std.StringHashMap(i128),
    child_process: ?std.process.Child = null,

    pub fn init(allocator: std.mem.Allocator, config: Config) !*WatchContext {
        const ctx = try allocator.create(WatchContext);
        ctx.* = .{
            .allocator = allocator,
            .config = config,
            .last_mod_times = std.StringHashMap(i128).init(allocator),
        };
        return ctx;
    }

    pub fn deinit(self: *WatchContext) void {
        self.last_mod_times.deinit();
        self.allocator.destroy(self);
    }

    fn shouldWatch(self: *WatchContext, path: []const u8) bool {
        // Check if path has watched extension
        for (self.config.file_extensions) |ext| {
            if (std.mem.endsWith(u8, path, ext)) {
                // Check if path is in excluded directory
                for (self.config.exclude_dirs) |excluded| {
                    if (std.mem.indexOf(u8, path, excluded) != null) {
                        return false;
                    }
                }
                return true;
            }
        }
        return false;
    }

    fn killCurrentProcess(self: *WatchContext) !void {
        if (self.child_process) |*child| {
            _ = try child.kill();
            _ = try child.wait();
            self.child_process = null;
        }
    }

    fn buildAndRun(self: *WatchContext) !void {
        // Kill the current process if running
        try self.killCurrentProcess();

        // Execute the run_dev_command (zig run)
        var child = std.process.Child.init(self.config.make_command, self.allocator);
        child.stderr_behavior = .Inherit;
        child.stdout_behavior = .Inherit;
        try child.spawn();
        // _ = try child.kill();

        // child = std.process.Child.init(self.config.server_command, self.allocator);
        // child.stderr_behavior = .Inherit;
        // child.stdout_behavior = .Inherit;
        // try child.spawn();

        self.child_process = child;
    }
};

// pub fn sendFrame(client: *Client, opcode: Opcode, payload: []const u8) !void {
//     var header: [2]u8 = undefined;
//     header[0] = @intFromEnum(opcode); // FIN bit set
//     header[0] = header[0] | 0x80;
//     if (payload.len <= 125) {
//         header[1] = @intCast(payload.len);
//     }
//     try client.writer.fillWriteBuffer(&header);
//     // _ = try client.writeMessage();
//     try client.writer.fillWriteBuffer(payload);
//     _ = try client.writeMessage();
//     // try stream.writeAll(&header);
//     // try stream.writeAll(payload);
// }

const HeaderNames = enum {
    Host,
    @"User-Agent",
    Connection,
    @"Sec-WebSocket-Key",
    @"Accept-Encoding",
};

const HTTPHeader = struct {
    requestLine: []const u8,
    host: []const u8,
    userAgent: []const u8,
    connection: []const u8,
    wskey: []const u8,
    content_encoding: []const u8 = "",

    pub fn print(self: HTTPHeader) void {
        std.debug.print("{s} - {s}\n", .{
            self.requestLine,
            self.host,
        });
    }
};

const digest_length = std.crypto.hash.Sha1.digest_length;
const Sha1 = std.crypto.hash.Sha1;
const base64 = std.base64;
pub fn generateAcceptKey(allocator: std.mem.Allocator, key: []const u8) ![]u8 {
    // The magic string to append (WebSocket GUID)
    const magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

    // Concatenate key + magic
    var concat = try allocator.alloc(u8, key.len + magic.len);
    defer allocator.free(concat);

    @memcpy(concat[0..key.len], key);
    @memcpy(concat[key.len..], magic);

    // Calculate SHA1 hash
    var hash: [digest_length]u8 = undefined;
    Sha1.hash(concat, &hash, .{});

    // Base64 encode
    const base64_size = base64.standard.Encoder.calcSize(hash.len);
    const encoded = try allocator.alloc(u8, base64_size);

    _ = base64.standard.Encoder.encode(encoded, &hash);

    return encoded;
}

pub fn parseHeader(header: []const u8) !HTTPHeader {
    var headerStruct = HTTPHeader{
        .requestLine = undefined,
        .host = undefined,
        .userAgent = undefined,
        .connection = undefined,
        .wskey = undefined,
    };
    var headerIter = std.mem.tokenizeSequence(u8, header, "\r\n");
    headerStruct.requestLine = headerIter.next() orelse return error.HeaderMalformed;
    while (headerIter.next()) |line| {
        const nameSlice = std.mem.sliceTo(line, ':');
        if (nameSlice.len == line.len) return error.HeaderMalformed;
        const headerName = std.meta.stringToEnum(HeaderNames, nameSlice) orelse continue;
        const headerValue = std.mem.trimLeft(u8, line[nameSlice.len + 1 ..], " ");
        switch (headerName) {
            .Host => headerStruct.host = headerValue,
            .@"User-Agent" => headerStruct.userAgent = headerValue,
            .Connection => headerStruct.connection = headerValue,
            .@"Sec-WebSocket-Key" => headerStruct.wskey = headerValue,
            .@"Accept-Encoding" => headerStruct.content_encoding = headerValue,
        }
    }
    return headerStruct;
}

pub fn parsePath(requestLine: []const u8) ![]const u8 {
    var requestLineIter = std.mem.tokenizeScalar(u8, requestLine, ' ');
    const method = requestLineIter.next().?;
    if (!std.mem.eql(u8, method, "GET")) return error.MethodNotSupported;
    const path = requestLineIter.next().?;
    if (path.len <= 0) return error.NoPath;
    const proto = requestLineIter.next().?;
    if (!std.mem.eql(u8, proto, "HTTP/1.1")) return error.ProtoNotSupported;
    // if (std.mem.eql(u8, path, "/")) {
    //     return "/index.html";
    // }
    return path;
}

const mimeTypes = .{
    .{ ".html", "text/html; charset=utf8" },
    .{ ".js", "application/javascript" },
    .{ ".wasm", "application/wasm" },
    .{ ".br", "application/wasm" },
    .{ ".css", "text/css" },
    .{ ".png", "image/png" },
    .{ ".webp", "image/webp" },
    .{ ".jpg", "image/jpeg" },
    .{ ".gif", "image/gif" },
    .{ ".svg", "image/svg+xml" },
    .{ ".txt", "text/html; charset=utf8" },
    .{ ".woff", "font/woff" },
    .{ ".woff2", "font/woff2" },
};

pub fn mimeForPath(path: []const u8) []const u8 {
    const extension = std.fs.path.extension(path);
    inline for (mimeTypes) |kv| {
        if (std.mem.eql(u8, extension, kv[0])) {
            return kv[1];
        }
    }
    return "text/html; charset=utf8";
}

pub fn openLocalFile(conn: std.net.Server.Connection, mime: []const u8, mimetype: []const u8, content_encoding: []const u8) !void {
    var allocator = std.heap.page_allocator;
    var path: []const u8 = "/index.html";
    if (mime.len > 1) {
        if (std.mem.indexOf(u8, mime, ".wasm") != null) {
            path = mime;
        } else if (std.mem.indexOf(u8, mime, ".br") != null) {
            path = mime;
        } else if (std.mem.indexOf(u8, mime, ".ico") != null) {
            path = "/favicon.ico";
        } else if (std.mem.indexOf(u8, mime, ".svg") != null) {
            path = mime;
        } else if (std.mem.indexOf(u8, mime, ".png") != null) {
            path = mime;
        } else if (std.mem.indexOf(u8, mime, ".webp") != null) {
            path = mime;
        } else if (std.mem.indexOf(u8, mime, ".js") != null) {
            path = mime;
        } else if (std.mem.indexOf(u8, mime, ".txt") != null) {
            path = mime;
        } else if (std.mem.indexOf(u8, mime, ".woff2") != null) {
            path = mime;
        } else {
            path = "/index.html";
        }
    }
    var encoding: []const u8 = "";
    if (content_encoding.len > 1 and std.mem.eql(u8, mimetype, "application/wasm")) {
        if (std.mem.indexOf(u8, content_encoding, "br") != null) {
            path = "/zig-out/bin/fabric-optimized.wasm.br";
            encoding = "br";
        } else if (std.mem.indexOf(u8, content_encoding, "gzip") != null) {
            encoding = "gzip";
            path = "/zig-out/bin/fabric-optimized.wasm.gzip";
        }
    }
    const file_cwd = try std.fmt.allocPrint(allocator, ".{s}", .{path});
    const cwd = std.fs.cwd();
    var file = cwd.openFile(file_cwd, .{}) catch |err| blk: {
        std.debug.print("Error opening file: {} {s}\n", .{ err, file_cwd });
        encoding = "";
        const default_file = cwd.openFile("./zig-out/bin/fabric-optimized.wasm", .{}) catch |default_err| {
            std.debug.print("Default Error opening file: {}\n", .{default_err});
            return;
        };
        break :blk default_file;
    }; // Get file size
    const file_size = try file.getEndPos();

    // Read the entire file
    const contents = try file.readToEndAlloc(allocator, file_size);
    defer allocator.free(contents);
    defer file.close();
    const httpHead =
        "HTTP/1.1 200 OK \r\n" ++
        "Connection: close\r\n" ++
        "Access-Control-Allow-Origin: *\r\n" ++
        "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" ++
        "Access-Control-Allow-Headers: Content-Type, Authorization\r\n" ++
        "Content-Type: {s}\r\n" ++
        "Content-Encoding: {s}\r\n" ++
        "Content-Length: {}\r\n" ++
        "\r\n" ++
        "{s}";
    const response = try std.fmt.allocPrint(allocator, httpHead, .{ mimetype, encoding, contents.len, contents });
    _ = try conn.stream.writer().write(response);
}

var global_writer: *std.net.Server.Connection = undefined;
pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const self_addr = try std.net.Address.resolveIp("0.0.0.0", 5173);
    var listener = try self_addr.listen(.{ .reuse_address = true });
    std.debug.print("{s}{s}Listening on http://localhost:5173{s}\n", .{ bold, white, reset });

    while (true) {
        var conn = try listener.accept();
        var recv_buf: [4096]u8 = undefined;
        var recv_total: usize = 0;
        while (conn.stream.read(recv_buf[recv_total..])) |recv_len| {
            if (recv_len == 0) break;
            recv_total += recv_len;
            if (std.mem.containsAtLeast(u8, recv_buf[0..recv_total], 1, "\r\n\r\n")) {
                break;
            }
        } else |read_err| {
            return read_err;
        }
        const recv_data = recv_buf[0..recv_total];
        if (recv_data.len == 0) {
            // Browsers (or firefox?) attempt to optimize for speed
            // by opening a connection to the server once a user highlights
            // a link, but doesn't start sending the request until it's
            // clicked. The request eventually times out so we just
            // go agane.
            std.debug.print("Got connection but no header!\n", .{});
            continue;
        }
        const header = try parseHeader(recv_data);
        const path = try parsePath(header.requestLine);
        const mimetype = mimeForPath(path);
        try openLocalFile(conn, path, mimetype, header.content_encoding);
        conn.stream.close();
    }
}
