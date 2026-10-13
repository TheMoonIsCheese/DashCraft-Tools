**DISCLAIMER**: Some features of this mod can be used in ways that are against the game's modding guidelines. These include:
- Completely banned:
  - Copying another person's track without their permission.
  - Placing pieces out of bounds.
- Not allowed on verified tracks:
  - Linked checkpoints that couldn't normally be linked.
  - Off-grid or partially rotated pieces.

# Download/Installation
Click the green "Code" button then "Download ZIP" to download. Make sure you extract the ZIP before proceeding.
<br>![image](https://github.com/user-attachments/assets/b2f29210-d2ee-4cfc-b8d8-5225a83b5cbb)

To install the extension, go to chrome://extensions and turn developer mode on in the top right corner. Then. click "Load unpacked" and select the folder with the extension.
<br>![image](https://github.com/user-attachments/assets/e4378cfa-9220-4187-8c51-76f0ddda1995)
**NOTE:** The folder will be 2 layers deep because of how Github exports the files (something like `C:\Users\Username\Downloads\Dashcraft-Tools-V2-main\Dashcraft-Tools-V2-main`).

# Using the extension
When you open the game and press tab, a few menus should pop up on the top of the screen.


## Miscellaneous

### Page Size
This will change the page size when browsing tracks (private and public). Toggle with the button on the left, then set the size on the right.

### Position in Thumbnail
This will put an indicator of your position directly on track thumbnails, similar to the like rate or lap count. Note that this makes thumbnails take slightly longer to load because of how it's implemented.

### Open in Editor
Entering a link here allows you to open tracks that aren't yours in the editor more easily than with the "Override Pieces". The inputted track will appear in the first slot of the first page of the "Build" tab. You may have to refresh the page by opening one of your tracks and exiting back out. This is useful for cut finding and, in combination with the "Save as Copy" mod, can allow you to copy other people's tracks.


## Track Editor

### Force Public
With this enabled, every track you save will be made public, even if you haven't beaten it.

### Link All Checkpoints
This forces every checkpoint in the track to link, even checkpoints that can't normally be linked.

### Save as Copy
Enabling this makes the game forget the ID of the track you're working on, so it just saves it as a new track instead. You have to save twice in a row to make it work, the first time to trick the game and the second time to actually save. In combination with the "Open in Editor" mod, this allows you to easily copy other people's tracks.

### Override Pieces
This mod replaces your track with whatever link or data you input. If your input is valid, there will be a green dot on the right. Then, open a track that has more pieces than what you're replacing it with, save, and reopen the track.


## Account Switcher

### Auto Add Accounts
With this enabled, any account you sign in to will automatically be added to the sign in tab.

### Sign In / Remove / Copy / Copy As Bookmark
Clicking this button toggles between the modes. When you hover over the button, a menu will appear on the right will all of your accounts. In Sign In mode, clicking an account will refresh the page and sign you in to that account. In Remove mode, clicking an account will remove it from the list. In copy mode, clicking an account will copy the token. And, in Copy As Bookmark mode, clicking an account will copy a bookmarklet that will sign you in to the account.

### Copy All / Paste
The copy button will copy the full list of account tokens to your clipboard. Sometimes your browser will just clear the extension's data, so you should store the tokens somewhere else. Never share these tokens with somebody else unless you want to give them access to your accounts. The paste button allows you to import one or multiple tokens from your clipboard.

## Editor Grid Snap

### X/Z and Y Snap
This allows you to adjust what increments the pieces snap to in-game. These inputs must be integers between 1 and 30. They will round/adjust to the closest number possible if a number outside of these parameters is inputted. This tool is made by [TechSubject](https://github.com/techsubject) and just modified to fit the UI. It does _not_ change the grid that is made in the editor. Note that the default snapping measure is 15.
