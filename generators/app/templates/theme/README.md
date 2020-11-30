![Hozokit logo.](wp-content/themes/<%= projectFolderName %>/screenshot.png)

# <%= projectName %>

<%= themeDescription %>

## Documentation

- [Hozokit](/HOZOKIT-README.md)
- [Creating Custom Blocks](/docs/blocks.md)
- [Enabling Hot Reload](/docs/hot_reload.md)

## Requirements

- Wordpress `5.0`
- MySQL `8.0.19`
- PHP `7.2.32`
- Node `<%= nodeVersion %>`

## Setup

[Download Wordpress](https://wordpress.org/download/) and copy the template folder to `wp-content/themes` folder.
Rename the template folder to match your chosen theme name.
> Wordpress might have already been installed if `yo hozokit` was ran, if so this step can be skipped.

Create a database and either add the details to a `wp-config.php` file or setup using the Wordpress onboarding.

> A webserver with php and mysql installed is required in order to follow these steps.

Navigate to the theme directory and set the Node version to the one available in [`.nvmrc`](wp-content/themes/<%= projectFolderName %>/.nvmrc). In this example the [Node Version Manager](https://github.com/nvm-sh/nvm) is used, but other methods of setting the version can be used.

Given that `nvm` is installed:

```bash
# Please check the included .nvmrc to get the correct version number.
nvm install <%= nodeVersion %>

# Will make use of .nvmrc to set the version.
# There might be a prompt to install the requested Node version if it's not present already.
nvm
```

<details>
<summary><b>Running npm scripts on WSL2</b> ⚠️</summary>
<br>

> This is required for Windows users who have a WSL2 setup.

There is an issue (described [here](https://github.com/microsoft/WSL/issues/4224) and [here](https://github.com/microsoft/WSL/issues/4739)) where Windows Subsystem Linux 2 won't listen to any changes made via a text editor running on Windows.

If you're a WSL2 user, these are the steps we took to solve the issue temporarily until a patch is released:

1. [Install Node for Windows](https://nodejs.org/en/download/)
1. [Install nvm for Windows](https://github.com/coreybutler/nvm-windows)
1. Open a Powershell window as an Administrator
1. On the Powershell, navigate to the theme directory. e.g wp-content/themes/<%= projectFolderName %>
1. Run `nvm use <%= nodeVersion %>` (in this case .nvmrc seems to be ignored so it needs to be specific)
1. npm install (if not already done)
1. npm start (to watch changes)

Any other tasks can still run on WSL2, however any Node tasks should be run from the Powershell to avoid issues.
</details>

<br>

Download and install dependencies (requires `Node`):

```bash
npm install
```

When changing scripts and styling run the following commands (might require `gulp-cli` installed globally):

```bash
npm start
# or
npm run watch
```
In order to build without watching for changes:

```bash
npm run build
```

> See [`gulpfile.js`](wp-content/themes/<%= projectFolderName %>/gulpfile.js) for all tasks.

[Hot Reloading can be enabled](/docs/hot_reload.md) once the steps above have been followed.

# Deployment

No details available at the moment. Update this section when there's information on how to deploy this app.

# Additional Notes

This project was scaffolded using the [Hozokit Generator](https://github.com/csalmeida/generator-hozokit) and it makes use of [Hozokit](https://github.com/csalmeida/hozokit) and [Wordpress](https://wordpress.org).