# Antigravity Excel Viewer (`excel-viewer`)

为 **Google Antigravity 2.0 桌面端** 打造的侧边栏 Excel / CSV 实时预览插件。

## 功能特性

- **侧边栏直接预览**：支持 `.xlsx`、`.xlsm`、`.csv`、`.tsv` 格式，无需切换软件即可在右侧辅助面板查看表格内容。
- **多 Sheet 切换 & 搜索**：支持切换 Excel 工作表标签页、关键词行过滤、点击单元格复制内容。
- **自动扫描工作区 & 下载目录**：自动列出当前项目及 `Downloads` 目录中的表格文件，也支持粘贴路径或从访达拖入文件。
- **自动刷新**：文件被修改后（如 Agent 增改列），面板会在数秒内自动刷新。
- **一键默认应用打开**：工具栏提供 **「默认应用打开」**（macOS 调用 Excel / Numbers / WPS）和 **「在访达中显示」**。
- **对话内一键直达**：内置插件规则（`rules/AGENTS.md`），Agent 生成或更新表格后会自动附带 `sidecar://` 预览胶囊，点击即可弹出侧边栏并定位到对应表格。

## 环境要求

- Google Antigravity 2.0 桌面端
- Python 3（需安装 `openpyxl`，用于解析 `.xlsx` / `.xlsm`）：
  ```bash
  pip3 install openpyxl
  ```

## 安装方法

1. 克隆本仓库到 Antigravity 插件目录：
   ```bash
   # macOS / Linux
   git clone https://github.com/cheyunzhuan/antigravity-excel-viewer.git ~/.gemini/config/plugins/excel-viewer
   ```
2. 重启 Antigravity，或在 **Customizations → Installed** 中开启 **Excel Preview**。
3. 在右侧辅助面板的 **Extensions** 中打开 **Excel 表格预览** 即可使用。

## 许可证

MIT
