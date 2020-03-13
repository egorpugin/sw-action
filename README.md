# sw-action

[GitHub Action](https://github.com/features/actions) to build projects with SW tool (https://software-network.org/)

# Usage

See [action.yml](action.yml)

Basic setup and usage:
```yaml
steps:
- uses: egorpugin/sw-action@master

- name: build
  run: ./sw build
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
