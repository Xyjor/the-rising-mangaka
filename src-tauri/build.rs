fn main() {
    // tauri-build does not watch icons/, so a changed icon would otherwise leave a stale one embedded in the exe.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
