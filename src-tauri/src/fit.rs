//! The first-launch fit. The window opens at 1280x800 logical, which on a small or high-scale screen does not fit:
//! Windows clamps it at creation to about the screen's height, and Tauri's `center` uses the size asked for, so the
//! title bar can start above the screen. On a first launch (no saved window), the window shrinks to at most 90% of its
//! monitor's work area on each axis and is centred in the work area, title bar on screen. A window the window-state
//! plugin restored is left where the player put it.

use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalRect, PhysicalSize, Runtime, WebviewWindow,
};
use tauri_plugin_window_state::AppHandleExt;

/// The window the game opens, as `tauri.conf.json` names it.
const MAIN: &str = "main";

/// Fits and centres the main window when nothing was saved for it and it is not maximised.
pub fn first_launch_fit<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window(MAIN) else {
        return Ok(());
    };
    // The plugin restores from this file before setup runs; read the same file to see whether it had anything.
    let state_file = app.path().app_config_dir()?.join(app.filename());
    let saved = std::fs::read_to_string(state_file).is_ok_and(|json| has_saved_window(&json, MAIN));
    if should_fit(saved, window.is_maximized()?) {
        fit_to_work_area(&window)?;
    }
    Ok(())
}

/// Shrinks the window to fit its monitor's work area when it overflows, then centres it there. The position comes from
/// the size the window really has after the resize, which Windows may hold at the minimum size.
fn fit_to_work_area<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };
    let work = *monitor.work_area();
    if let Some(content) = fitted_size(work.size, window.outer_size()?, window.inner_size()?) {
        window.set_size(content)?;
    }
    window.set_position(centred(work, window.outer_size()?))?;
    Ok(())
}

/// Whether to fit: only a first launch (no saved window) in a window that is not maximised.
fn should_fit(saved: bool, maximised: bool) -> bool {
    !saved && !maximised
}

/// Whether the window-state file `json` holds a real saved window under `label` (the plugin restores only those; an
/// entry with no size is its empty default).
fn has_saved_window(json: &str, label: &str) -> bool {
    let Ok(states) = serde_json::from_str::<serde_json::Value>(json) else {
        return false;
    };
    let dimension = |key: &str| states[label][key].as_u64().unwrap_or(0);
    dimension("width") > 0 && dimension("height") > 0
}

/// For a window of `outer` size around `inner` content that overflows `area`: the content size that makes the whole
/// window at most 90% of `area` on each axis (never larger than it is), or None when it already fits.
fn fitted_size(
    area: PhysicalSize<u32>,
    outer: PhysicalSize<u32>,
    inner: PhysicalSize<u32>,
) -> Option<PhysicalSize<u32>> {
    if outer.width <= area.width && outer.height <= area.height {
        return None;
    }
    let width = outer.width.min(area.width * 9 / 10);
    let height = outer.height.min(area.height * 9 / 10);
    Some(PhysicalSize::new(
        width.saturating_sub(outer.width.saturating_sub(inner.width)),
        height.saturating_sub(outer.height.saturating_sub(inner.height)),
    ))
}

/// The position that centres a window of `outer` size in `work`, never left of or above the work area.
fn centred(work: PhysicalRect<i32, u32>, outer: PhysicalSize<u32>) -> PhysicalPosition<i32> {
    let offset = |room: u32, size: u32| ((i64::from(room) - i64::from(size)) / 2).max(0);
    PhysicalPosition::new(
        (i64::from(work.position.x) + offset(work.size.width, outer.width)) as i32,
        (i64::from(work.position.y) + offset(work.size.height, outer.height)) as i32,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn work_area(x: i32, y: i32, width: u32, height: u32) -> PhysicalRect<i32, u32> {
        PhysicalRect {
            position: PhysicalPosition::new(x, y),
            size: PhysicalSize::new(width, height),
        }
    }

    #[test]
    fn fits_only_a_first_launch_that_is_not_maximised() {
        assert!(should_fit(false, false));
        assert!(!should_fit(true, false));
        assert!(!should_fit(false, true));
        assert!(!should_fit(true, true));
    }

    #[test]
    fn a_saved_main_window_counts() {
        let json = r#"{"main":{"width":1213,"height":616,"prev_x":0,"prev_y":0,"x":68,"y":36,"maximized":false,
            "visible":true,"decorated":true,"fullscreen":false}}"#;
        assert!(has_saved_window(json, "main"));
    }

    #[test]
    fn no_file_content_another_window_an_empty_entry_or_bad_json_does_not() {
        assert!(!has_saved_window("", "main"));
        assert!(!has_saved_window("{}", "main"));
        assert!(!has_saved_window(
            r#"{"other":{"width":800,"height":600}}"#,
            "main"
        ));
        assert!(!has_saved_window(
            r#"{"main":{"width":0,"height":0}}"#,
            "main"
        ));
        assert!(!has_saved_window("{\"main\":", "main"));
    }

    #[test]
    fn a_window_that_fits_is_left_its_size() {
        // 1280x800 content in a 16x39 frame on a 1920x1080 screen with a 40 px taskbar.
        let (outer, inner) = (PhysicalSize::new(1296, 839), PhysicalSize::new(1280, 800));
        assert_eq!(
            fitted_size(PhysicalSize::new(1920, 1040), outer, inner),
            None
        );
        assert_eq!(
            fitted_size(PhysicalSize::new(1296, 839), outer, inner),
            None
        );
    }

    #[test]
    fn a_window_clamped_on_a_1366x768_screen_takes_90_percent_of_the_work_area() {
        // 100% scale, 40 px taskbar: work area 1366x728. Windows created the window 1296x784 (clamped from 839), so
        // its content is 1280x745 in the 16x39 frame. Whole window min(1296, 1229) = 1229 (1229.4 floored) by
        // min(784, 655) = 655 (655.2 floored); content 1229-16 = 1213 by 655-39 = 616.
        let (outer, inner) = (PhysicalSize::new(1296, 784), PhysicalSize::new(1280, 745));
        assert_eq!(
            fitted_size(PhysicalSize::new(1366, 728), outer, inner),
            Some(PhysicalSize::new(1213, 616))
        );
    }

    #[test]
    fn a_window_on_a_1920x1080_screen_at_150_percent_takes_90_percent_of_the_work_area() {
        // 150%: taskbar 72 px, work area 1920x1008. The 1920x1200 content in a 24x57 frame was clamped to 1944x1106
        // (content 1920x1049). Whole window min(1944, 1728) = 1728 by min(1106, 907) = 907 (907.2 floored);
        // content 1728-24 = 1704 by 907-57 = 850.
        let (outer, inner) = (PhysicalSize::new(1944, 1106), PhysicalSize::new(1920, 1049));
        assert_eq!(
            fitted_size(PhysicalSize::new(1920, 1008), outer, inner),
            Some(PhysicalSize::new(1704, 850))
        );
    }

    #[test]
    fn a_window_too_tall_on_an_ultrawide_screen_keeps_its_width() {
        // 2560x1080 at 150%: work area 2560x1008, the same clamped 1944x1106 window. Width min(1944, 2304) = 1944,
        // unchanged (90% would widen it); height min(1106, 907) = 907. Content 1944-24 = 1920 by 907-57 = 850.
        let (outer, inner) = (PhysicalSize::new(1944, 1106), PhysicalSize::new(1920, 1049));
        assert_eq!(
            fitted_size(PhysicalSize::new(2560, 1008), outer, inner),
            Some(PhysicalSize::new(1920, 850))
        );
    }

    #[test]
    fn centres_in_the_work_area_of_a_1366x768_screen() {
        // Work area 1366x728 at the origin, window 1229x655: x (1366-1229)/2 = 68 (68.5 floored),
        // y (728-655)/2 = 36 (36.5 floored).
        assert_eq!(
            centred(work_area(0, 0, 1366, 728), PhysicalSize::new(1229, 655)),
            PhysicalPosition::new(68, 36)
        );
    }

    #[test]
    fn a_window_taller_than_the_work_area_starts_at_its_top() {
        // 1920x1080 at 150%: the 850 content asked for is under the 640 logical (960) minimum, so Windows keeps the
        // window 1728x1017 (960+57) in a 1920x1008 work area. x (1920-1728)/2 = 96; y (1008-1017)/2 < 0, held at 0.
        assert_eq!(
            centred(work_area(0, 0, 1920, 1008), PhysicalSize::new(1728, 1017)),
            PhysicalPosition::new(96, 0)
        );
    }

    #[test]
    fn centres_on_a_monitor_left_of_the_main_one() {
        // A 1600x900 monitor at x -1600 with a 40 px taskbar: work area 1600x860 at (-1600, 0), window 1296x839.
        // x -1600 + (1600-1296)/2 = -1600 + 152 = -1448; y (860-839)/2 = 10 (10.5 floored).
        assert_eq!(
            centred(work_area(-1600, 0, 1600, 860), PhysicalSize::new(1296, 839)),
            PhysicalPosition::new(-1448, 10)
        );
    }
}
