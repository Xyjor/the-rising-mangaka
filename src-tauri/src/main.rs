// Release builds run without the extra console window on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    rising_mangaka_lib::run()
}
