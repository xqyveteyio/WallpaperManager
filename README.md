WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 yarn tauri dev


WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 ./src-tauri/target/release/wallpaper-manager

yarn tauri build
upx --best src-tauri/target/release/wallpaper-manager