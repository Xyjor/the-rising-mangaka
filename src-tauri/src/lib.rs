//! The desktop shell: one window around the unchanged Vite build in `../dist`. The window, the content security
//! policy and the bundle live in `tauri.conf.json`; the capabilities in `capabilities/`.

/// Opens the main window and runs the app until it closes.
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running The Rising Mangaka");
}
