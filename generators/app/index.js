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

module.exports = class extends Generator {
  prompting() {
    // Have Yeoman greet the user.
    this.log(yosay(`The ${chalk.blue("hozokit")} theme generator.`));

    const prompts = [
      {
        type: "input",
        name: "projectName",
        message: "What is your project name?",
        default: "Hozokit" // Default to current folder name
      },
      {
        type: "confirm",
        name: "installWordpress",
        message: "Would you like Wordpress to be installed?",
        default: true
      },
      {
        type: "input",
        name: "themeUri",
        message: "Theme URI (a repository, a demo or showcase page):",
        default: "https://github.com/csalmeida/hozokit"
      },
      {
        type: "input",
        name: "themeDescription",
        message: "Theme description:"
      },
      {
        type: "input",
        name: "themeAuthor",
        message: "Theme author (name or company):"
      },
      {
        type: "input",
        name: "themeAuthorUri",
        message: "Theme author URI (name or company):"
      },
      {
        type: "input",
        name: "themeTags",
        message:
          "Any additional tags? (separated by a comma, useful if the theme is going to be published to wordpress.org):"
      }
    ];

    return this.prompt(prompts).then(props => {
      // To access props later use this.props.someAnswer;
      this.props = props;
      // Makes the project folder name available to templates.
      this.props.projectFolderName = this._dashify(this.props.projectName);
      // Prepares additional tags to be appended to base.scss.
      this.props.themeTags = `, ${this.props.themeTags}`;
    });
  }

  writing() {
    // Installs Wordpress and Hozokit
    if (this.props.installWordpress) {
      this._installWordpress(this._dashify(this.props.projectFolderName));
    } else {
      // Installs Hozokit
      // Templates are generated in this method as well.
      this._installHozokit(this._dashify(this.props.projectFolderName));
    }
  }

  /**
   * Downloads and installs the latest version of Wordpress in the project root directory.
   * This functionality should be optional and a Hozokit project should still be able to be generated whether or not this function runs.
   * @param {String} projectName Name of the project, used to name root folder. e.g 'hozokit' or this.props.projectName
   */
  _installWordpress(projectName) {
    // Creates the project directory if one is not already in place.
    this._createProjectDirectory(projectName);

    const spinners = ["Downloading Wordpress"];
    const m = new Multispinner(spinners);
    // Downloads a zipped copy of Wordpress into the folder.
    const zipPath = `./${projectName}/wordpress.zip`;
    const file = fs.createWriteStream(zipPath);
    const downloadURL = "https://wordpress.org/latest.zip";

    // This message is shown later to the user if any issues with the download come up.
    let downloadError = null;
    https
      .get(downloadURL, function(response) {
        response.pipe(file);

        // Use to add logic for when a request is in progress.
        // response.on('data', (data) => {
        // });

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
    m.on("success", () => {
      // This.log(`${chalk.green('Success:')} Download of Wordpress has completed.`);
      // this._extractWordpress(projectName)
      this._extractZip(
        projectName,
        "wordpress.zip",
        `./${projectName}/`,
        "Extracting Wordpress"
      );

      this._installHozokit(this._dashify(this.props.projectFolderName));
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
    });
  }

  /**
   * Downloads and installs the latest version of Hozokit in the project root directory.
   * @param {String} projectName Name of the project, used to name root folder. e.g 'hozokit' or this.props.projectName
   */
  _installHozokit(projectName) {
    // Creates the project directory if one is not already in place.
    this._createProjectDirectory(projectName);

    // Generates progress spinners for user to see on the terminal.
    const spinners = [
      "Looking up latest Hozokit release",
      "Downloading Hozokit"
    ];
    const m = new Multispinner(spinners);

    // Downloads a zipped copy of Wordpress into the folder.
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
    m.on("success", () => {
      this._extractZip(
        projectName,
        "hozokit-main.zip",
        `./${projectName}/`,
        `Extracting Hozokit ${hozokit.name}`
      );
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
    });
  }

  /**
   * Extracts zip archives into a folder and moves them to a desired location.
   * Original zip and created folder are removed after uncompressing.
   * Used when installing Wordpress and Hozokit.
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
    const spinners = [spinnerText];
    const m = new Multispinner(spinners);

    // Extracts contents of Wordpress.
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

          // Generate templates
          this._generateFromTemplates();
        }

        // If no error has been set, mark as successful.
        if (extractError === null) {
          m.success(spinners[0]);
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
    });
  }

  /**
   * Generates code from templates, using user input.
   */
  _generateFromTemplates() {
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

    // The props template files will use.
    var templateProps = { ...this.props, nodeVersion: "13.0.1" };

    // If a folder with the project name exists, create the templates.
    // This prevents a separate folder to be created in cases where it doesn't exist.
    if (fs.existsSync(newDirName)) {
      // Retrieves the Node version of Hozokit and uses it in the README file.
      const nvmrcPath = `${this.props.projectFolderName}/wp-content/themes/${this.props.projectFolderName}/.nvmrc`;
      if (fs.existsSync(nvmrcPath)) {
        const data = fs.readFileSync(nvmrcPath, "utf8", function(error, data) {
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

      console.log(templateProps);

      const filePath = {
        baseStyles: `${this.props.projectFolderName}/wp-content/themes/${this.props.projectFolderName}/styles/base.scss`,
        readme: `${this.props.projectFolderName}/README.md`
      };

      // Adds a customized base.scss which defines theme information.
      try {
        fs.unlinkSync(filePath.baseStyles);

        this.fs.copyTpl(
          this.templatePath("theme/base.scss"),
          this.destinationPath(filePath.baseStyles),
          { ...templateProps }
        );
      } catch (error) {
        templateError = `
        Could not remove ./${filePath.baseStyles}. \n
        ./${error}
        `;
      }

      // Rename the README file and make use of template to generate one for the project.
      // Rename the directory to match the project name.
      const oldReadmeName = `./${this.props.projectFolderName}/README.md`;
      const newReadmeName = `./${this.props.projectFolderName}/HOZOKIT-README.md`;

      try {
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
    if (templateError !== null) {
      console.error(templateError);
    }
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

  // Install() {
  //   this.installDependencies();
  // }
};
