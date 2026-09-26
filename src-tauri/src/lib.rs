//! The desktop shell: one window around the unchanged Vite build in `../dist`. The window, the content security
//! policy and the bundle live in `tauri.conf.json`; the capabilities in `capabilities/`. On the desktop, a second
//! launch brings the running window forward, and the window keeps its size, position and maximised state between runs.

#[cfg(desktop)]
use tauri::{AppHandle, LogicalSize, Manager, Runtime, WebviewWindow};
use tauri::{PhysicalPosition, PhysicalRect, PhysicalSize};

/// Opens the main window and runs the app until it closes.
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = desktop(builder);
    builder
        .run(tauri::generate_context!())
        .expect("error while running The Rising Mangaka");
}

/// The desktop plugins and the first-run window fit.
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
        .setup(|app| {
            let default = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .map(|w| LogicalSize::new(w.width, w.height));
            if let (Some(window), Some(default)) = (app.get_webview_window("main"), default) {
                fit_to_work_area(&window, default)?;
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

/// When the window opens at its default size (nothing restored) and that does not fit its monitor's work area (a small
/// or high-scale screen), shrinks it to 90% of the work area, centred. A restored or maximised window is left alone.
#[cfg(desktop)]
fn fit_to_work_area<R: Runtime>(
    window: &WebviewWindow<R>,
    default: LogicalSize<f64>,
) -> tauri::Result<()> {
    let inner = window.inner_size()?;
    if window.is_maximized()? || inner != default.to_physical::<u32>(window.scale_factor()?) {
        return Ok(());
    }
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };
    if let Some((size, position)) = fitted(*monitor.work_area(), window.outer_size()?, inner) {
        window.set_size(size)?;
        window.set_position(position)?;
    }
    Ok(())
}

/// For a window of `outer` size around `inner` content: the content size and window position that make the whole window
/// 90% of `work`, centred in it, or None when it already fits.
fn fitted(
    work: PhysicalRect<i32, u32>,
    outer: PhysicalSize<u32>,
    inner: PhysicalSize<u32>,
) -> Option<(PhysicalSize<u32>, PhysicalPosition<i32>)> {
    let area = work.size;
    if outer.width <= area.width && outer.height <= area.height {
        return None;
    }
    let width = area.width * 9 / 10;
    let height = area.height * 9 / 10;
    let content = PhysicalSize::new(
        width.saturating_sub(outer.width.saturating_sub(inner.width)),
        height.saturating_sub(outer.height.saturating_sub(inner.height)),
    );
    let left = ((area.width - width) / 2) as i32;
    let top = ((area.height - height) / 2) as i32;
    let position = PhysicalPosition::new(work.position.x + left, work.position.y + top);
    Some((content, position))
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

    /// The default 1280x800 content at 100% scale, in a 16x39 frame (borders and title bar).
    const OUTER: PhysicalSize<u32> = PhysicalSize::new(1296, 839);
    const INNER: PhysicalSize<u32> = PhysicalSize::new(1280, 800);

    #[test]
    fn a_window_that_fits_is_left_alone() {
        // A 1920x1080 screen with a 40 px taskbar.
        assert_eq!(fitted(work_area(0, 0, 1920, 1040), OUTER, INNER), None);
    }

    #[test]
    fn a_window_exactly_the_size_of_the_work_area_fits() {
        assert_eq!(fitted(work_area(0, 0, 1296, 839), OUTER, INNER), None);
    }

    #[test]
    fn a_window_too_tall_takes_90_percent_of_the_work_area_centred() {
        // A 1366x768 screen with a 40 px taskbar: the work area is 1366x728 and the window is 839 tall.
        // Whole window 1229x655 (1229.4 and 655.2 floored); content 1229-16 = 1213 by 655-39 = 616;
        // position (1366-1229)/2 = 68 (68.5 floored), (728-655)/2 = 36 (36.5 floored).
        assert_eq!(
            fitted(work_area(0, 0, 1366, 728), OUTER, INNER),
            Some((PhysicalSize::new(1213, 616), PhysicalPosition::new(68, 36)))
        );
    }

    #[test]
    fn a_window_too_big_on_a_second_monitor_centres_in_that_work_area() {
        // A second 1280x1024 monitor to the right of a 1920 px one, taskbar 40 px: work area 1280x984 at (1920, 0).
        // At 125% the default content is 1600x1000 in a 20x49 frame: 1620x1049.
        // Whole window 1152x885 (885.6 floored); content 1152-20 = 1132 by 885-49 = 836;
        // position 1920 + (1280-1152)/2 = 1984, (984-885)/2 = 49 (49.5 floored).
        let outer = PhysicalSize::new(1620, 1049);
        let inner = PhysicalSize::new(1600, 1000);
        assert_eq!(
            fitted(work_area(1920, 0, 1280, 984), outer, inner),
            Some((
                PhysicalSize::new(1132, 836),
                PhysicalPosition::new(1984, 49)
            ))
        );
    }
}
