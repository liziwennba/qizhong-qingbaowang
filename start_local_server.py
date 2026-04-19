#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Tuple

ROOT = Path(__file__).resolve().parent
DOCS_DIR = ROOT / 'docs'
PLAYER_JS_PATH = DOCS_DIR / 'player-data.js'
PLAYER_JSON_PATH = DOCS_DIR / 'player-data.json'
BACKUP_DIR = ROOT / 'backups'
BACKUP_DIR.mkdir(exist_ok=True)

CONFIG = {
    'port': int(os.environ.get('TEAM_LOOKUP_PORT', '8000')),
    'git_remote': os.environ.get('TEAM_GIT_REMOTE', 'origin'),
    'git_branch': os.environ.get('TEAM_GIT_BRANCH', 'main'),
    'auto_push': os.environ.get('TEAM_AUTO_PUSH', '0') == '1',
    'commit_prefix': os.environ.get('TEAM_GIT_COMMIT_PREFIX', 'Update player-data'),
}


def run_cmd(cmd, cwd=ROOT) -> Tuple[int, str, str]:
    proc = subprocess.run(cmd, cwd=str(cwd), text=True, capture_output=True)
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def is_git_repo() -> bool:
    code, out, _ = run_cmd(['git', 'rev-parse', '--is-inside-work-tree'])
    return code == 0 and out == 'true'


def git_remote_exists(remote: str) -> bool:
    code, _, _ = run_cmd(['git', 'remote', 'get-url', remote])
    return code == 0


def get_server_info():
    repo_ok = is_git_repo()
    remote_ok = repo_ok and git_remote_exists(CONFIG['git_remote'])
    return {
        'backendSaveAvailable': True,
        'gitRepo': repo_ok,
        'gitRemote': CONFIG['git_remote'],
        'gitBranch': CONFIG['git_branch'],
        'gitRemoteConfigured': remote_ok,
        'autoPushDefault': CONFIG['auto_push'],
        'docsDir': str(DOCS_DIR.relative_to(ROOT)),
    }


def git_commit_and_push(changed_files):
    if not is_git_repo():
        return {'ok': False, 'error': '当前目录不是 Git 仓库，无法推送到 GitHub。'}
    if not git_remote_exists(CONFIG['git_remote']):
        return {'ok': False, 'error': f"未找到 Git remote：{CONFIG['git_remote']}"}

    code, out, err = run_cmd(['git', 'add'] + changed_files)
    if code != 0:
        return {'ok': False, 'error': err or out or 'git add 失败'}

    status_code, status_out, status_err = run_cmd(['git', 'diff', '--cached', '--name-only'])
    if status_code != 0:
        return {'ok': False, 'error': status_err or status_out or '无法检查 Git 暂存区状态'}
    staged = [line.strip() for line in status_out.splitlines() if line.strip()]
    if not staged:
        return {'ok': True, 'message': '没有需要提交的文件。', 'pushed': False}

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    commit_message = f"{CONFIG['commit_prefix']} {now}"
    code, out, err = run_cmd(['git', 'commit', '-m', commit_message])
    if code != 0:
        text = (err or out or '').lower()
        if 'nothing to commit' in text:
            return {'ok': True, 'message': '没有新的改动需要提交。', 'pushed': False}
        return {'ok': False, 'error': err or out or 'git commit 失败'}

    code, out, err = run_cmd(['git', 'push', CONFIG['git_remote'], CONFIG['git_branch']])
    if code != 0:
        return {
            'ok': False,
            'error': err or out or 'git push 失败',
            'committed': True,
            'commitMessage': commit_message,
        }

    return {
        'ok': True,
        'pushed': True,
        'commitMessage': commit_message,
        'pushOutput': out,
    }


class TeamHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DOCS_DIR), **kwargs)

    def log_message(self, format, *args):
        print('[server]', format % args)

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/api/server-info':
            self._send_json(200, get_server_info())
            return
        return super().do_GET()

    def do_POST(self):
        if self.path != '/api/save-player-db':
            self._send_json(404, {'ok': False, 'error': 'Not Found'})
            return

        try:
            content_length = int(self.headers.get('Content-Length', '0'))
            raw = self.rfile.read(content_length)
            payload = json.loads(raw.decode('utf-8'))
            db = payload.get('db')
            push_to_github = bool(payload.get('pushToGitHub', False)) or CONFIG['auto_push']
            if not isinstance(db, dict) or 'players' not in db or 'playerList' not in db:
                raise ValueError('请求中缺少有效的 db 数据')

            now = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_js = BACKUP_DIR / f'player-data_{now}.js'
            if PLAYER_JS_PATH.exists():
                backup_js.write_text(PLAYER_JS_PATH.read_text(encoding='utf-8'), encoding='utf-8')

            js_content = 'window.PLAYER_DB = ' + json.dumps(db, ensure_ascii=False, separators=(',', ':')) + ';\n'
            PLAYER_JS_PATH.write_text(js_content, encoding='utf-8')
            PLAYER_JSON_PATH.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding='utf-8')

            result = {
                'ok': True,
                'saved_to': str(PLAYER_JS_PATH.relative_to(ROOT)),
                'json_backup': str(PLAYER_JSON_PATH.relative_to(ROOT)),
                'backup_copy': str(backup_js.relative_to(ROOT)) if backup_js.exists() else '',
                'git': None,
            }

            if push_to_github:
                result['git'] = git_commit_and_push([
                    str(PLAYER_JS_PATH.relative_to(ROOT)),
                    str(PLAYER_JSON_PATH.relative_to(ROOT)),
                ])

            self._send_json(200, result)
        except Exception as error:
            self._send_json(500, {'ok': False, 'error': str(error)})


def main():
    parser = argparse.ArgumentParser(description='启动队伍查询网页，并可选保存后推送到 GitHub。')
    parser.add_argument('--port', type=int, default=CONFIG['port'])
    parser.add_argument('--git-remote', default=CONFIG['git_remote'])
    parser.add_argument('--git-branch', default=CONFIG['git_branch'])
    parser.add_argument('--auto-push', action='store_true', default=CONFIG['auto_push'])
    parser.add_argument('--commit-prefix', default=CONFIG['commit_prefix'])
    args = parser.parse_args()

    CONFIG['port'] = args.port
    CONFIG['git_remote'] = args.git_remote
    CONFIG['git_branch'] = args.git_branch
    CONFIG['auto_push'] = args.auto_push
    CONFIG['commit_prefix'] = args.commit_prefix

    info = get_server_info()
    print(f'本地服务已启动：http://127.0.0.1:{CONFIG["port"]}')
    print('静态页面目录：', DOCS_DIR)
    print('保存接口：POST /api/save-player-db')
    print('Git 仓库：', '是' if info['gitRepo'] else '否')
    print('Git remote：', CONFIG['git_remote'])
    print('Git branch：', CONFIG['git_branch'])
    print('自动推送：', '开启' if CONFIG['auto_push'] else '关闭')
    if not info['gitRepo']:
        print('提示：当前目录不是 Git 仓库，只能本地保存文件。')
    elif not info['gitRemoteConfigured']:
        print(f'提示：未找到 remote {CONFIG["git_remote"]}，保存后无法推送到 GitHub。')
    else:
        print('提示：若你的 GitHub 认证已配好，可在网页里点击“保存并推送 GitHub”。')

    server = ThreadingHTTPServer(('0.0.0.0', CONFIG['port']), TeamHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n已停止。')


if __name__ == '__main__':
    main()
