//! The desktop shell: one window around the unchanged Vite build in `../dist`. The window, the content security
//! policy and the bundle live in `tauri.conf.json`; the capabilities in `capabilities/`. On the desktop, a second
//! launch brings the running window forward, the window keeps its size, position and maximised state between runs,
//! and the file dialogs export and load a save file.

#[cfg(desktop)]
mod fit;

#[cfg(desktop)]
use tauri::{AppHandle, Manager, Runtime};

/// Opens the main window and runs the app until it closes.
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = desktop(builder);
    builder
        .run(tauri::generate_context!())
        .expect("error while running The Rising Mangaka");
}

/// The desktop plugins and the first-launch window fit.
#[cfg(desktop)]
fn desktop<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    use tauri_plugin_window_state::StateFlags;
    builder
        // First, so a second launch hands over to the running window before anything else starts.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main(app)
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        // Export and load a save file: the dialogs pick the file, and each picked path joins the fs scope for the
        // session, so reading or writing it needs no standing scope.
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // A window that cannot be fitted still opens: report it and carry on rather than fail the setup.
            if let Err(err) = fit::first_launch_fit(app.handle()) {
                eprintln!("The Rising Mangaka: could not fit the window to the screen: {err}");
            }
            Ok(())
        })
}

/// Brings the running window forward, out of the taskbar if it was minimised.
#[cfg(desktop)]
fn focus_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
