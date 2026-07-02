# fedora 运行
WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 neu run

WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 ./dist/wallpaper-manager/wallpaper-manager-linux_x64


# 编译
neu build --embed-resources


# 跨平台的动画壁纸管理软件 支持设置不同的数据源，源就是一个json数组文件 仅此而已