#[cfg(desktop)]
use tauri::{
    Manager,
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());
    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_geolocation::init());

    #[cfg(desktop)]
    let builder = builder
        .menu(|app| {
            let quit = MenuItem::with_id(app, "quit", "退出", true, Some("Alt+F4"))?;
            let file = Submenu::with_items(app, "文件", true, &[&quit])?;
            let edit = Submenu::with_items(
                app,
                "编辑",
                true,
                &[
                    &PredefinedMenuItem::undo(app, Some("撤销"))?,
                    &PredefinedMenuItem::redo(app, Some("重做"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, Some("剪切"))?,
                    &PredefinedMenuItem::copy(app, Some("复制"))?,
                    &PredefinedMenuItem::paste(app, Some("粘贴"))?,
                    &PredefinedMenuItem::select_all(app, Some("全选"))?,
                ],
            )?;
            let reload = MenuItem::with_id(app, "reload", "刷新页面", true, Some("F5"))?;
            let fullscreen = MenuItem::with_id(app, "fullscreen", "切换全屏", true, Some("F11"))?;
            let devtools = MenuItem::with_id(
                app,
                "devtools",
                "打开开发者工具",
                true,
                Some("Ctrl+Shift+I"),
            )?;
            let view = Submenu::with_items(
                app,
                "查看",
                true,
                &[
                    &reload,
                    &fullscreen,
                    &PredefinedMenuItem::separator(app)?,
                    &devtools,
                ],
            )?;
            let about = PredefinedMenuItem::about(
                app,
                Some("关于航海"),
                Some(AboutMetadata {
                    name: Some("航海".into()),
                    version: Some(app.package_info().version.to_string()),
                    ..Default::default()
                }),
            )?;
            let help = Submenu::with_items(app, "帮助", true, &[&about])?;
            Menu::with_items(app, &[&file, &edit, &view, &help])
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "quit" {
                app.exit(0);
                return;
            }
            let Some(window) = app.get_webview_window("main") else {
                return;
            };
            let result = match event.id().as_ref() {
                // Open explicitly so selecting the menu always reveals the inspector.
                "devtools" => {
                    window.open_devtools();
                    Ok(())
                }
                "reload" => window.reload(),
                "fullscreen" => window
                    .is_fullscreen()
                    .and_then(|fullscreen| window.set_fullscreen(!fullscreen)),
                _ => Ok(()),
            };
            if let Err(error) = result {
                eprintln!("菜单操作失败: {error}");
            }
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
