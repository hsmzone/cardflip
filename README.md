# 카드 짝 맞추기

`start-game.bat`을 더블클릭하면 브라우저에서 게임이 열립니다. Python 3가 필요하며, 실행 중에는 서버 창을 열어두세요.

캐릭터는 `cha` 폴더에 넣습니다. PNG, JPG, JPEG, WebP, GIF, AVIF, SVG 파일을 지원합니다. 이름은 확장자를 제외한 파일명으로 표시합니다.

게임 시작을 누를 때마다 폴더를 다시 읽고 6 / 12 / 18 / 24종을 무작위 선택해 각각 두 장씩 만듭니다. 이미지가 부족한 쌍 수는 선택할 수 없습니다. 최소 6종이 필요합니다.

`index.html`을 직접 열면 마지막으로 생성된 `characters.js` 목록을 사용합니다. 준비 화면의 폴더 선택으로 최신 캐릭터를 읽을 수도 있습니다. 폴더 변경을 자동 반영하려면 `start-game.bat`으로 실행하세요.

## GitHub Pages 배포

저장소의 Settings → Pages → Source를 GitHub Actions로 설정합니다. main 브랜치에 업로드하면 `.github/workflows/pages.yml`이 `build_site.py`를 실행해 이미지 목록을 자동 생성하고 배포합니다. `cha` 폴더의 이미지를 추가·삭제·변경한 뒤 main에 업로드하면 사이트에도 반영됩니다.

수동 정적 배포는 `python build_site.py`를 실행한 뒤 `_site` 폴더의 내용만 호스팅에 올리면 됩니다. 배포된 게임은 같은 경로의 `characters.json` 목록을 사용합니다.
