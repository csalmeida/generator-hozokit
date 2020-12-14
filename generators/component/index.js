"use strict";
// Required for generator to work
const Generator = require("yeoman-generator");
const chalk = require("chalk");
const yosay = require("yosay");

const fs = require("fs");

module.exports = class extends Generator {
  prompting() {
    // Have Yeoman greet the user.
    this.log(yosay(`The ${chalk.blue("Hozokit")} component generator.`));

    // Retrieves previous user choices of project settings.
    const projectSettings = this.config.get("projectSettings")
      ? this.config.get("projectSettings")
      : null;

    const componentSettings = this.config.get("componentSettings")
      ? this.config.get("componentSettings")
      : null;

    const prompts = [
      {
        type: "input",
        name: "componentName",
        message: `Component name (e.g Hero Section):
  The name will be reformatted to reference the component in files and name its folder.`,
        default:
          componentSettings !== null &&
          typeof componentSettings.componentName !== "undefined"
            ? this._dashify(componentSettings.componentName)
            : "New Component"
      },
      {
        type: "input",
        name: "componentDescription",
        message: `Description:`,
        default:
          componentSettings !== null &&
          typeof componentSettings.componentDescription !== "undefined"
            ? this._dashify(componentSettings.componentDescription)
            : null
      },
      {
        type: "input",
        name: "componentClassPrefix",
        message: `Selector class prefix (e.g hoz):
  Class prefixes tend to be used to better identify components when styling them. Prefix is remembered for next time.`,
        default:
          componentSettings !== null &&
          typeof componentSettings.componentClassPrefix !== "undefined"
            ? this._dashify(componentSettings.componentClassPrefix)
            : null
      },
      {
        type: "input",
        name: "projectFolderName",
        message: `What is the name of your theme folder?
  Located in wp-content/themes. Should be separated by dashes (e.g hozokit-wordpress-project)`,
        default:
          projectSettings !== null &&
          typeof projectSettings.projectName !== "undefined"
            ? this._dashify(projectSettings.projectName)
            : null
      }
    ];

    return this.prompt(prompts).then(props => {
      // To access props later use this.props.someAnswer;
      this.props = props;
      // Makes the project folder name available to templates.
      this.props.componentNameFormatted = this._snakify(
        this.props.componentName
      );
      // Adds a dashed version of the name to be used in CSS class references.
      this.props.componentNameDashified = this._dashify(
        this.props.componentName
      );
      // Prepares additional tags to be appended to base.scss.
      this.props.componentClassPrefix = this._snakify(
        this.props.componentClassPrefix
      );

      // Saves user configuration so that they're used as defaults in the future.
      this.config.set("componentSettings", this.props);
    });
  }

  writing() {
    // Tries to find the project directory
    const projectDirectory = `${process.cwd()}/${
      this.props.projectFolderName
    }/wp-content/themes/${this.props.projectFolderName}`;

    // Checks if the user is in the root directory project directory.
    try {
      if (fs.existsSync(projectDirectory)) {
        // Create component directory, it takes the whole path and appends the directory where the new component should be placed.
        this._createDirectory(
          `${projectDirectory}/templates/components/${this.props.componentNameFormatted}`
        );

        // Paths used in generating files from templates.
        const filePath = {
          twig: `${projectDirectory}/templates/components/${this.props.componentNameFormatted}/index.twig`,
          scss: `${projectDirectory}/templates/components/${this.props.componentNameFormatted}/style.scss`
        };

        try {
          this.fs.copyTpl(
            this.templatePath("index.twig"),
            this.destinationPath(filePath.twig),
            { ...this.props }
          );
        } catch (error) {
          this.log(`
          Could not create '${filePath.twig}'. \n
          ./${error}
          `);
        }

        try {
          this.fs.copyTpl(
            this.templatePath("style.scss"),
            this.destinationPath(filePath.scss),
            { ...this.props }
          );
        } catch (error) {
          this.log(`
          Could not create '${filePath.scss}'. \n
          ./${error}
          `);
        }
      }
    } catch (error) {
      // Throw error
      this.log(`${chalk.red("Error:")} Could not find project directory.
    Change directory to the folder where Wordpress is installed or the theme folder in order to create a component.`);
      this.log(error);
    }
  }

  /**
   * It creates a directory if one is not already in place.
   * It is useful when running generators separately that
   * require a folder to be in place before a task is performed.
   * @param {String} directory Complete directory where folder should be created. e.g './themes/hozokit/template/components' or this.props.projectName
   */
  _createDirectory(directory) {
    try {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
      }
    } catch (err) {
      this.log(err);
    }
  }

  /**
   * It transforms a string separated by spaces into an underscore separated one.
   * For example Super Awesome Component will be converted to super_awesome_component.
   * This is useful to create component directories for users without prompting them for the component folder name.
   * @param {String} value The value to be snakified. e.g 'Super Awesome Component'
   * @param {String} target (optional) The string that will be replaced with the separator. The default is a space ' '.
   * @param {String} separator (optional) The string the target value should be replaced with. The default is an underscore '_'.
   */
  _snakify(value, target = " ", separator = "_") {
    const lowerCaseValue = value.toLowerCase();
    return lowerCaseValue.split(target).join(separator);
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
};
