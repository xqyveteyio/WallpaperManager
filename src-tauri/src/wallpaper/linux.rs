use std::process::Command;

pub fn set_wallpaper(path: String) -> Result<(), String> {
    if !std::path::Path::new(&path).exists() {
        return Err(format!("file does not exist: {path}"));
    }

    let file_uri = format!("file://{path}");
    run_gsettings("org.gnome.desktop.background", "picture-uri", &file_uri)?;
    run_gsettings("org.gnome.desktop.background", "picture-uri-dark", &file_uri)?;

    Ok(())
}

fn run_gsettings(schema: &str, key: &str, value: &str) -> Result<(), String> {
    let output = Command::new("gsettings")
        .args(["set", schema, key, value])
        .output()
        .map_err(|error| format!("failed to execute gsettings: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "gsettings failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}
