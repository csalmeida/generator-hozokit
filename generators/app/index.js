"use strict";
// Required for generator to work
const Generator = require("yeoman-generator");
const chalk = require("chalk");
const yosay = require("yosay");

// Used to download and unzip files
// const https = require('https');
const https = require("follow-redirects/https");
const fs = require("fs");
const AdmZip = require("adm-zip");
const fse = require("fs-extra");

// Used to convey loading states in the terminal (loading, downloading...)
const Multispinner = require("multispinner");

// Used to install dependencies when downloads and extractions are done.
const childProcess = require("child_process");

module.exports = class extends Generator {
  prompting() {
    // Have Yeoman greet the user.
    this.log(
      yosay(`The ${chalk.blue("Hozokit")} theme generator for WordPress.`)
    );

    // Initial instructions.
    this.log(
      `
  ${chalk.inverse("WELCOME!")}
  This generator will ask EIGHT questions in total, before installation.
  All fields are optional and defaults are shown in brackets.

  If the installation fails please refer to Hozokit's setup guide:
  https://github.com/csalmeida/hozokit#manual-install`
    );

    // Retrieves previous user choices of project settings.
    const projectSettings = this.config.get("projectSettings")
      ? this.config.get("projectSettings")
      : null;

    const prompts = [
      {
        type: "input",
        name: "projectName",
        message: `
  
  ${chalk.inverse("INSTALLATION OPTIONS")}
  (1/3) What is your project name? (e.g My Hozokit Project)`,
        default:
          projectSettings !== null &&
          typeof projectSettings.projectName !== "undefined"
            ? projectSettings.projectName
            : "Hozokit" // Default to current folder name
      },
      {
        type: "confirm",
        name: "installWordpress",
        message: "(2/3) Would you like WordPress to be installed?",
        default:
          projectSettings !== null &&
          typeof projectSettings.installWordpress !== "undefined"
            ? projectSettings.installWordpress
            : true
      },
      {
        type: "input",
        name: "webserverURL",
        message: `(3/3) What's the address of the webserver for this install? e.g http://localhost:3000:
  (Used to setup hot reloading)`,
        default:
          projectSettings !== null &&
          typeof projectSettings.webserverURL !== "undefined"
            ? projectSettings.webserverURL
            : null
      },
      {
        type: "input",
        name: "themeUri",
        message: `
  ${chalk.inverse("THEME CONFIGURATION")}
  (1/5) Theme URI (a repository, a demo or showcase page):`,
        default:
          projectSettings !== null &&
          typeof projectSettings.themeUri !== "undefined"
            ? projectSettings.themeUri
            : "https://github.com/csalmeida/hozokit"
      },
      {
        type: "input",
        name: "themeDescription",
        message: "(2/5) Theme description:",
        default:
          projectSettings !== null &&
          typeof projectSettings.themeDescription !== "undefined"
            ? projectSettings.themeDescription
            : null
      },
      {
        type: "input",
        name: "themeAuthor",
        message: "(3/5) Theme author (name or company):",
        default:
          projectSettings !== null &&
          typeof projectSettings.themeAuthor !== "undefined"
            ? projectSettings.themeAuthor
            : null
      },
      {
        type: "input",
        name: "themeAuthorUri",
        message: "(4/5) Theme author URI (name or company):",
        default:
          projectSettings !== null &&
          typeof projectSettings.themeAuthorUri !== "undefined"
            ? projectSettings.themeAuthorUri
            : null
      },
      {
        type: "input",
        name: "themeTags",
        message:
          "(5/5) Any additional tags? (separated by a comma, useful if the theme is going to be published to wordpress.org):",
        default:
          projectSettings !== null &&
          typeof projectSettings.themeTags !== "undefined"
            ? projectSettings.themeTags
            : null
      }
    ];

    return this.prompt(prompts).then(props => {
      // To access props later use this.props.someAnswer;
      this.props = props;
      // Makes the project folder name available to templates.
      this.props.projectFolderName = this._dashify(this.props.projectName);
      // Prepares additional tags to be appended to base.scss.
      this.props.themeTags = `${this.props.themeTags}`;

      // Saves user configuration so that they're used as defaults in the future.
      this.config.set("projectSettings", this.props);
    });
  }

  writing() {
    // Installs Wordpress and Hozokit
    if (this.props.installWordpress) {
      this._installWordpress(this._dashify(this.props.projectFolderName))
        .then(projectName => {
          return this._extractZip(
            projectName,
            "wordpress.zip",
            `./${projectName}/`,
            "Extracting WordPress"
          );
        })
        .then(() => {
          return this._installHozokit(
            this._dashify(this.props.projectFolderName)
          );
        })
        .then(promiseData => {
          const { projectName, hozokit } = promiseData;

          return this._extractZip(
            projectName,
            "hozokit-main.zip",
            `./${projectName}/`,
            `Extracting Hozokit ${hozokit.name}`
          );
        })
        .then(() => {
          return this._generateFromTemplates();
        })
        .then(() => {
          return this._installHozokitDependencies(this.props.projectFolderName);
        })
        .then(dependenciesInstalled => {
          return this._printAdditionalSteps(
            this.props.projectFolderName,
            dependenciesInstalled
          );
        })
        .catch(error => {
          this.log(error);
        });
    } else {
      // Installs Hozokit
      this._installHozokit(this._dashify(this.props.projectFolderName))
        .then(promiseData => {
          const { projectName, hozokit } = promiseData;

          return this._extractZip(
            projectName,
            "hozokit-main.zip",
            `./${projectName}/`,
            `Extracting Hozokit ${hozokit.name}`
          );
        })
        .then(() => {
          return this._generateFromTemplates();
        })
        .then(() => {
          return this._installHozokitDependencies(this.props.projectFolderName);
        })
        .then(dependenciesInstalled => {
          return this._printAdditionalSteps(
            this.props.projectFolderName,
            dependenciesInstalled
          );
        })
        .catch(error => {
          this.log(error);
        });
    }
  }

  // Installs Hozokit dependencies if a compatible version of Node is detected.
  install() {
    // This is done in writting() to allow downloads to finish before trying to install dependencies.
  }

  /**
   * Downloads and installs the latest version of WordPress in the project root directory.
   * This functionality should be optional and a Hozokit project should still be able to be generated whether or not this function runs.
   * @param {String} projectName Name of the project, used to name root folder. e.g 'hozokit' or this.props.projectName
   */
  _installWordpress(projectName) {
    return new Promise((resolve, reject) => {
      // Creates the project directory if one is not already in place.
      this._createProjectDirectory(projectName);

      // Starts loading spinners in the terminal. Allows user to measure progress of process.
      const spinners = ["Downloading WordPress"];
      const m = new Multispinner(spinners);

      // Downloads a zipped copy of WordPress into the folder.
      const zipPath = `./${projectName}/wordpress.zip`;
      const file = fs.createWriteStream(zipPath);
      const downloadURL = "https://wordpress.org/latest.zip";

      // This message is shown later to the user if any issues with the download come up.
      let downloadError = null;
      https
        .get(downloadURL, function(response) {
          response.pipe(file);

          response.on("end", () => {
            if (response.statusCode === 200) {
              m.success(spinners[0]);
            } else {
              downloadError = `Download has failed. (${response.statusCode})`;
              m.error(spinners[0]);
            }
          });
        })
        .on("error", error => {
          downloadError = error;
          m.error(spinners[0]);
        });

      // Displays a message once download is complete.
      // Alerts that promise has resolved to allow other action to run.
      m.on("success", () => {
        // Returns the projectName in order to pass it to extraction.
        resolve(projectName);
      }).on("err", error => {
        if (downloadError) {
          this.log(`${chalk.red("Error:")} ${downloadError}`);
        } else {
          this.log(
            `${chalk.red(
              "Error:"
            )} ${error} Download has been cancelled with an unknown error.`
          );
        }

        reject(error);
      });
    });
  }

  /**
   * Downloads and installs the latest version of Hozokit in the project root directory.
   * @param {String} projectName Name of the project, used to name root folder. e.g 'hozokit' or this.props.projectName
   */
  _installHozokit(projectName) {
    return new Promise((resolve, reject) => {
      // Creates the project directory if one is not already in place.
      this._createProjectDirectory(projectName);

      // Generates progress spinners for user to see on the terminal.
      const spinners = [
        "Looking up latest Hozokit release",
        "Downloading Hozokit"
      ];
      const m = new Multispinner(spinners);

      // Downloads a zipped copy of WordPress into the folder.
      const zipPath = `./${projectName}/hozokit-main.zip`;
      const file = fs.createWriteStream(zipPath);
      // Getting data on the URL is necessary to be passed into the request options.
      const releaseUrl = new URL(
        "https://api.github.com/repos/csalmeida/hozokit/releases/latest"
      );
      // Data on the latest hozokit release.
      let hozokit = null;

      // This message is shown later to the user if any issues with the download come up.
      let downloadError = null;

      // Retrieves information on the latest available release of Hozokit.
      // User-Agent is required for GitHub to take request.
      const options = {
        host: releaseUrl.host,
        path: releaseUrl.pathname,
        headers: {
          "User-Agent": "Hozokit Generator v0.0"
        }
      };

      https
        .get(options, function(response) {
          // Stores the response body for later use.
          let body = "";
          response.on("data", function(chunk) {
            body += chunk;
          });

          response.on("end", () => {
            if (response.statusCode === 200) {
              hozokit = JSON.parse(body);
              m.success(spinners[0]);

              if (hozokit) {
                const downloadUrl = new URL(hozokit.zipball_url);
                let options = {
                  host: downloadUrl.host,
                  path: downloadUrl.pathname,
                  headers: {
                    "User-Agent": "Hozokit Generator v0.0"
                  }
                };

                // Downloads the zip file of the latest release from Github.
                https
                  .get(options, function(response) {
                    response.pipe(file);

                    response.on("end", () => {
                      if (response.statusCode === 200) {
                        m.success(spinners[1]);
                      } else {
                        downloadError = `Download has failed. (${response.statusCode})`;
                        m.error(spinners[1]);
                      }
                    });
                  })
                  .on("error", error => {
                    downloadError = error;
                    m.error(spinners[1]);
                  });
              }
            } else {
              downloadError = `Request has failed. (${response.statusCode})`;
              m.error(spinners[0]);
            }
          });
        })
        .on("error", error => {
          downloadError = error;
          m.error(spinners[0]);
        });

      // Displays a message once download is complete.
      // Alerts that promise has resolved to allow other actions to run.
      m.on("success", () => {
        // Returns the projectName in order to pass it to extraction.
        const promiseData = { projectName, hozokit };
        resolve(promiseData);
      }).on("err", error => {
        if (downloadError) {
          this.log(`${chalk.red("Error:")} ${downloadError}`);
        } else {
          this.log(
            `${chalk.red(
              "Error:"
            )} ${error} Download has been cancelled with an unknown error.`
          );
        }

        reject(error);
      });
    });
  }

  /**
   * Extracts zip archives into a folder and moves them to a desired location.
   * Original zip and created folder are removed after uncompressing.
   * Used when installing WordPress and Hozokit.
   * @param {String} projectName Name of the project, used to name root folder. e.g 'hozokit' or this.props.projectName
   * @param {String} fileZipName The name of the zip to be extracted. e.g 'hozokit-main.zip'
   * @param {String} copyPath (optional) The target path files should be copied to. This is a move since files are removed after extraction. Defaults to project directory. e.g './project-name'
   * @param {String} spinnerText (optional) The message shown whilst the spinner is in progress.
   */
  _extractZip(
    projectName,
    fileZipName,
    copyPath = null,
    spinnerText = "Extracting"
  ) {
    return new Promise((resolve, reject) => {
      const spinners = [spinnerText];
      const m = new Multispinner(spinners);

      // Extracts contents of WordPress.
      const extractPath = `./${projectName}/${fileZipName}`;
      const zip = new AdmZip(extractPath);
      // Makes use of the entries to figure out which folder name was created when file was extracted.
      const zipEntries = zip.getEntries();
      const extractedFolder = `./${projectName}/${zipEntries[0].entryName}`;
      zip.extractAllTo(`${projectName}/`, true);

      let extractError = null;

      // If a copy path is not provided files won't be moved.
      if (copyPath) {
        fse.copy(extractedFolder, copyPath, { overwrite: true }, err => {
          if (err) {
            extractError = `
            Could not copy files to ./${copyPath}. \n
            ./${err}
            `;
          } else {
            // Cleans up by removing extracted folder and zip.
            try {
              fs.rmdirSync(extractedFolder, { recursive: true });
            } catch (err) {
              extractError = `
                Could not remove extractedFolder. \n
                ./${err}
                `;
              m.error(spinners[0]);
            }

            // Remove zip file as it is not longer needed.
            try {
              fs.unlinkSync(extractPath);
            } catch (error) {
              extractError = `
              Could not remove ./${extractPath}. \n
              ./${error}
              `;
              m.error(spinners[0]);
            }
          }

          // If no error has been set, mark as successful.
          if (extractError === null) {
            m.success(spinners[0]);
            resolve();
          }
        });
      } else {
        // Cleans up by removing extracted folder and zip.
        // Lets user know that program did not work as intended.
        try {
          fs.rmdirSync(extractedFolder, { recursive: true });
        } catch (err) {
          extractError = `
            Could not remove extractedFolder. \n
            ./${err}
            `;
          m.error(spinners[0]);
        }

        // Remove zip file as it is not longer needed.
        try {
          fs.unlinkSync(extractPath);
        } catch (error) {
          extractError = `
          Could not remove ./${extractPath}. \n
          ./${error}
          `;
          m.error(spinners[0]);
        }

        this.log(`${chalk.red(
          "Error:"
        )} Could not copy files (copyPath is not present).
        Zip file and extracted files were removed.`);
      }

      // Displays error messages once extract is complete.
      m.on("err", error => {
        if (extractError) {
          this.log(`${chalk.red("Error:")} ${extractError}`);
        } else {
          this.log(
            `${chalk.red(
              "Error:"
            )} ${error} Extract has been stopped with an unknown error.`
          );
        }

        reject(error);
      });
    });
  }

  /**
   * Generates code from templates, using user input.
   */
  _generateFromTemplates() {
    return new Promise((resolve, reject) => {
      // Starts loading spinners in the terminal. Allows user to measure progress of process.
      const spinners = ["Setup Hozokit base files with given parameters"];
      const m = new Multispinner(spinners);

      // Used to store an error message in case something goes wrong.
      let templateError = null;

      // Rename the directory to match the project name.
      const oldDirName = `./${this.props.projectFolderName}/wp-content/themes/hozokit`;
      const newDirName = `./${this.props.projectFolderName}/wp-content/themes/${this.props.projectFolderName}`;

      // Check if the hozokit theme folder exists.
      if (fs.existsSync(oldDirName)) {
        try {
          fs.renameSync(oldDirName, newDirName);
        } catch (error) {
          templateError = `
          Could not rename theme folder to match project name (${this.props.projectFolderName}). \n
          ./${error}
          `;
        }
      }

      // Makes sure the value of webserver is a valid string. Otherwise it renders it null so the template does not make use of it.
      var webserverURL =
        typeof this.props.webserverURL === "string" &&
        this.props.webserverURL.length > 0
          ? this.props.webserverURL
          : null;

      // The props template files will use.
      var templateProps = {
        ...this.props,
        nodeVersion: "14.15.1",
        webserverURL
      };

      // If a folder with the project name exists, create the templates.
      // This prevents a separate folder to be created in cases where it doesn't exist.
      if (fs.existsSync(newDirName)) {
        // Retrieves the Node version of Hozokit and uses it in the README file.
        const nvmrcPath = `${this.props.projectFolderName}/wp-content/themes/${this.props.projectFolderName}/.nvmrc`;
        if (fs.existsSync(nvmrcPath)) {
          const data = fs.readFileSync(nvmrcPath, "utf8", function(
            error,
            data
          ) {
            if (error) {
              templateError = `
              Could not read ./${nvmrcPath}. \n
              ./${error}
              `;
            } else {
              return data;
            }
          });

          if (data !== null) {
            templateProps.nodeVersion = data.substring(1);
          }
        }

        // Paths used in generating files from templates.
        const filePath = {
          baseStyles: `${this.props.projectFolderName}/wp-content/themes/${this.props.projectFolderName}/styles/base.scss`,
          env: `${this.props.projectFolderName}/wp-content/themes/${this.props.projectFolderName}/.env`,
          readme: `${this.props.projectFolderName}/README.md`
        };

        // Adds a customized base.scss which defines theme information.
        try {
          // Removes default base.scss.
          fs.unlinkSync(filePath.baseStyles);

          this.fs.copyTpl(
            this.templatePath("theme/base.scss"),
            this.destinationPath(filePath.baseStyles),
            { ...templateProps }
          );
        } catch (error) {
          templateError = `
          Could not create './${filePath.baseStyles}'. \n
          ./${error}
          `;
        }

        // Adds a customized .env.
        try {
          this.fs.copyTpl(
            this.templatePath("theme/.env"),
            this.destinationPath(filePath.env),
            { ...templateProps }
          );
        } catch (error) {
          templateError = `
          Could not create './${filePath.env}'. \n
          ./${error}
          `;
        }

        // Rename the README file and make use of template to generate one for the project.
        // Rename the directory to match the project name.
        const oldReadmeName = `./${this.props.projectFolderName}/README.md`;
        const newReadmeName = `./${this.props.projectFolderName}/HOZOKIT-README.md`;

        try {
          // Renames Hozokit's README.
          fs.renameSync(oldReadmeName, newReadmeName);

          this.fs.copyTpl(
            this.templatePath("theme/README.md"),
            this.destinationPath(filePath.readme),
            { ...templateProps }
          );
        } catch (error) {
          templateError = `
          Could not rename theme README file. \n
          ./${error}
          `;
        }
      }

      // Temporary error logging.
      if (templateError === null) {
        m.success(spinners[0]);
      } else {
        m.error(spinners[0]);
      }

      m.on("success", () => {
        resolve();
      }).on("err", () => {
        this.log(`${chalk.red("Error:")} ${templateError}`);

        reject(templateError);
      });
    });
  }

  /**
   * It creates the project directory if one is not already in place.
   * It is useful when running generators separately that
   * require the project root folder to be in place before a task is performed.
   * @param {String} projectName Name of the project, used to name root folder. e.g 'hozokit' or this.props.projectName
   */
  _createProjectDirectory(projectName) {
    const directory = `./${projectName}`;
    try {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
        // This.log("Created temporary directory.");
      }
    } catch (err) {
      this.log(err);
    }
  }

  /**
   * It transforms a string separated by spaces into a dash separated one.
   * For example Hozokit Generator Project will be converted to hozokit-generator-project.
   * This is useful to create project directories for users without prompting them for the project folder name.
   * @param {String} value The value to be dashified. e.g 'Hozokit Generator Project'
   * @param {String} target (optional) The string that will be replaced with the separator. The default is a space ' '.
   * @param {String} separator (optional) The string the target value should be replaced with. The default is a dash '-'.
   */
  _dashify(value, target = " ", separator = "-") {
    const lowerCaseValue = value.toLowerCase();
    return lowerCaseValue.split(target).join(separator);
  }

  /**
   * Prints additional steps the user has to take in order to configure a Hozokit build.
   * Runs after downloading Hozokit and/or WordPress and trying to install dependencies.
   * require the project root folder to be in place before a task is performed.
   * @param {String} projectFolderName Name of the project folder, used in paths and outputs for the user benefit. e.g 'hozokit' or this.props.projectFolderName
   */
  _printAdditionalSteps(projectFolderName, dependenciesInstalled = false) {
    return new Promise((resolve, reject) => {
      // Default node version if none is found.
      let nodeVersion = "14.15.1";

      // Retrives node version if available.
      const nvmrcPath = `${this.props.projectFolderName}/wp-content/themes/${this.props.projectFolderName}/.nvmrc`;
      if (fs.existsSync(nvmrcPath)) {
        const data = fs.readFileSync(nvmrcPath, "utf8", function(error, data) {
          if (error) {
            const nodeVersionError = `
            Could not read ./${nvmrcPath}. \n
            ./${error}
            `;
            reject(nodeVersionError);
          } else {
            return data;
          }
        });

        if (data !== null) {
          nodeVersion = data.substring(1);
        }
      }

      this.log(`
${chalk.inverse("NEXT STEPS")}
Below are some helpful reminders to complete your setup.`);

      this.log(`
1. Setup a webserver capable of running PHP and create a MySQL database for WordPress.
   See https://wordpress.org/support/article/how-to-install-wordpress/ to learn more.`);

      if (
        typeof dependenciesInstalled === "boolean" &&
        dependenciesInstalled === true
      ) {
        this.log(`
2. Change directory to ${projectFolderName}/wp-content/themes/${projectFolderName}
   To start development run ${chalk.inverse("npm start")}`);

        this.log(`
3. You now have the power to create Twig components instantly!
   Change directory into your theme folder and run ${chalk.inverse(
     "yo hozokit:component"
   )}`);
      } else {
        this.log(`
2. Install Hozokit Node dependencies for your theme.
  2.1 Change directory to ${projectFolderName}/wp-content/themes/${projectFolderName}
  2.2 Check you are using Node version ${nodeVersion} by running ${chalk.inverse(
          "node --version"
        )}
  2.3 Run ${chalk.inverse("npm install")}`);

        this.log(`
3. To start development run ${chalk.inverse("npm start")}`);

        this.log(`
4. You now have the power to create Twig components instantly!
   Change directory into your theme folder and run ${chalk.inverse(
     "yo hozokit:component"
   )}`);
      }

      this.log(`
👋 For more details, checkout Hozokit's setup guide and documentation available at
https://github.com/csalmeida/hozokit
              `);

      resolve();
    });
  }

  /**
   * Attemps to install Hozokit's Node dependencies.
   * Starts by looking for an .nvmrc file to retrieve expected version then
   * attempts to run npm install if expected version is set.
   * Otherwise, it will error out and give further instructions.
   * @param {String} projectFolderName Name of the project folder, used in paths and outputs for the user benefit. e.g 'hozokit' or this.props.projectFolderName
   */
  _installHozokitDependencies(projectFolderName) {
    return new Promise((resolve, reject) => {
      // Starts a new spinner.
      const spinners = ["Installing dependencies (this might take a while)"];
      const m = new Multispinner(spinners);

      const directory = `./${projectFolderName}/wp-content/themes/${projectFolderName}`;
      let nodeVersion = process.version;
      let nodeVersionError = null;
      let nodeVersionWarning = null;

      // Retrives node version from the theme folder.
      // Used to determine which version of Node Hozokit currently uses.
      const nvmrcPath = `${projectFolderName}/wp-content/themes/${projectFolderName}/.nvmrc`;
      if (fs.existsSync(nvmrcPath)) {
        const data = fs.readFileSync(nvmrcPath, "utf8", function(error, data) {
          if (error) {
            nodeVersionError = `
            
Could not read ./${nvmrcPath}. \n
./${error}
            `;
          } else {
            return data;
          }
        });

        // Installs dependencies if the expected version of Node is present.
        if (data !== null && data === nodeVersion) {
          process.chdir(directory);
          // Cannot use this.installDependencies({ bower: false, npm: true });
          // As it does not run as expected sometimes. It might be because other operations have not finished.
          // Running npm directly instead.
          try {
            // Runs npm install with no logging to the terminal. This allows the use of the spinner.
            childProcess.execSync("npm install", { stdio: undefined });
          } catch (error) {
            nodeVersionError = `
${chalk.red("Error:")}
Could not install dependencies via npm:
${error}
            `;

            m.error(spinners[0]);
          }
        } else {
          // User is informed that version is not compatible and they will have to install dependencies themselves.
          nodeVersionWarning = `

${chalk.yellow("Warning:")}
Avoided dependency install because current Node version is ${nodeVersion}.
Please set Node to ${data}, change directory to ${directory} and run ${chalk.inverse(
            "npm install"
          )}
Alternatively, attempt to install dependencies with your current version following the steps above but keeping Node ${nodeVersion} set.
`;
        }
      }

      // Sets symbols and text color to signal a warning instead of success.
      if (nodeVersionWarning) {
        m.symbol = {
          ...m.symbol,
          success: m.symbol.error
        };

        m.color = {
          success: "yellow"
        };
      }

      if (nodeVersionError === null) {
        m.success(spinners[0]);
      } else {
        m.error(spinners[0]);
      }

      m.on("success", () => {
        // Used to determine which output next steps should use.
        let dependenciesInstalled = true;

        // A warning is printed if any available.
        if (nodeVersionWarning) {
          // The next steps output is changed is dependencies could not be installed.
          dependenciesInstalled = false;
          // Displays a warning to the user.
          this.log(nodeVersionWarning);
        }

        resolve(dependenciesInstalled);
      }).on("err", () => {
        reject(nodeVersionError);
      });
    });
  } // End of _installHozokitDependencies
};
