use tauri::{path::BaseDirectory, AppHandle, Manager};
use tauri_plugin_shell::{process::Command, ShellExt};

const CLI_INSTALL_DIR: &str = ".anyon/bin";
const CLI_BINARY_NAME: &str = "anyon";

fn get_target_triple() -> &'static str {
    #[cfg(all(target_arch = "x86_64", target_os = "macos"))]
    return "x86_64-apple-darwin";

    #[cfg(all(target_arch = "aarch64", target_os = "macos"))]
    return "aarch64-apple-darwin";

    #[cfg(all(target_arch = "x86_64", target_os = "windows"))]
    return "x86_64-pc-windows-msvc";

    #[cfg(all(target_arch = "x86_64", target_os = "linux"))]
    return "x86_64-unknown-linux-gnu";
}

fn get_cli_install_path() -> Option<std::path::PathBuf> {
    std::env::var("HOME").ok().map(|home| {
        std::path::PathBuf::from(home)
            .join(CLI_INSTALL_DIR)
            .join(CLI_BINARY_NAME)
    })
}

pub fn get_sidecar_path(app: &AppHandle) -> std::path::PathBuf {
    // Use current_binary which properly resolves symlinks and handles App Translocation
    // The sidecar is named with the target triple suffix (e.g., anyon-cli-aarch64-apple-darwin)
    tauri::process::current_binary(&app.env())
        .expect("Failed to get current binary")
        .parent()
        .expect("Failed to get parent dir")
        .join(format!("anyon-cli-{}", get_target_triple()))
}

pub fn create_command(app: &AppHandle, args: &str) -> Command {
    let state_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .expect("Failed to resolve app local data dir");

    // Use Tauri's sidecar() on all platforms - it automatically handles:
    // - Target suffix (anyon-cli-aarch64-apple-darwin)
    // - App bundle paths
    // - App Translocation on macOS
    app.shell()
        .sidecar("anyon-cli")
        .unwrap()
        .args(args.split_whitespace())
        .env("ANYON_EXPERIMENTAL_ICON_DISCOVERY", "true")
        .env("ANYON_CLIENT", "desktop")
        .env("XDG_STATE_HOME", &state_dir)
}

fn is_cli_installed() -> bool {
    get_cli_install_path()
        .map(|path| path.exists())
        .unwrap_or(false)
}

#[tauri::command]
pub fn install_cli(app: AppHandle) -> Result<String, String> {
    if cfg!(not(unix)) {
        return Err("CLI installation is only supported on macOS & Linux".to_string());
    }

    let sidecar = get_sidecar_path(&app);
    if !sidecar.exists() {
        return Err("Sidecar binary not found".to_string());
    }

    let install_path =
        get_cli_install_path().ok_or_else(|| "Could not determine install path".to_string())?;

    if let Some(parent) = install_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create install directory: {}", e))?;
    }

    std::fs::copy(&sidecar, &install_path)
        .map_err(|e| format!("Failed to copy binary: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&install_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to set binary permissions: {}", e))?;
    }

    Ok(install_path.to_string_lossy().to_string())
}

pub fn sync_cli(app: tauri::AppHandle) -> Result<(), String> {
    if cfg!(debug_assertions) {
        println!("Skipping CLI sync for debug build");
        return Ok(());
    }

    if !is_cli_installed() {
        println!("No CLI installation found, skipping sync");
        return Ok(());
    }

    let cli_path =
        get_cli_install_path().ok_or_else(|| "Could not determine CLI install path".to_string())?;

    let output = std::process::Command::new(&cli_path)
        .arg("--version")
        .output()
        .map_err(|e| format!("Failed to get CLI version: {}", e))?;

    if !output.status.success() {
        return Err("Failed to get CLI version".to_string());
    }

    let cli_version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let cli_version = semver::Version::parse(&cli_version_str)
        .map_err(|e| format!("Failed to parse CLI version '{}': {}", cli_version_str, e))?;

    let app_version = app.package_info().version.clone();

    if cli_version >= app_version {
        println!(
            "CLI version {} is up to date (app version: {}), skipping sync",
            cli_version, app_version
        );
        return Ok(());
    }

    println!(
        "CLI version {} is older than app version {}, syncing",
        cli_version, app_version
    );

    install_cli(app)?;

    println!("Synced installed CLI");

    Ok(())
}
