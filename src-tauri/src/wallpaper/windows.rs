use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;

use windows_sys::Win32::UI::WindowsAndMessaging::{
    SystemParametersInfoW, SPI_SETDESKWALLPAPER, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE,
};

pub fn set_wallpaper(path: String) -> Result<(), String> {
    if !std::path::Path::new(&path).exists() {
        return Err(format!("file does not exist: {path}"));
    }

    let mut wide_path: Vec<u16> = OsStr::new(&path).encode_wide().collect();
    wide_path.push(0);

    let ok = unsafe {
        SystemParametersInfoW(
            SPI_SETDESKWALLPAPER,
            0,
            wide_path.as_mut_ptr().cast(),
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
        )
    };

    if ok == 0 {
        return Err(format!(
            "SystemParametersInfoW failed: {}",
            std::io::Error::last_os_error()
        ));
    }

    Ok(())
}
