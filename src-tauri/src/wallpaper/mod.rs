#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "windows")]
mod windows;

#[tauri::command]
pub fn set_wallpaper(path: String) -> Result<(), String> {
    platform::set_wallpaper(path)
}

#[cfg(target_os = "linux")]
mod platform {
    pub use super::linux::set_wallpaper;
}

#[cfg(target_os = "windows")]
mod platform {
    pub use super::windows::set_wallpaper;
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
mod platform {
    pub fn set_wallpaper(_path: String) -> Result<(), String> {
        Err("set_wallpaper is not supported on this platform".to_string())
    }
}
