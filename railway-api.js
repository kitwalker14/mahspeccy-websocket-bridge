/**
 * Railway API Client
 * GraphQL API wrapper for Railway platform operations
 * Documentation: https://docs.railway.app/reference/public-api
 */

import fetch from 'node-fetch';

const RAILWAY_GRAPHQL_ENDPOINT = 'https://backboard.railway.app/graphql/v2';

export class RailwayAPI {
  constructor(token) {
    if (!token) {
      throw new Error('Railway API token is required. Get it from: https://railway.app/account/tokens');
    }
    this.token = token;
  }

  /**
   * Execute GraphQL query against Railway API
   */
  async query(query, variables = {}) {
    try {
      const response = await fetch(RAILWAY_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      const json = await response.json();

      if (json.errors) {
        console.error('❌ Railway API Error:', JSON.stringify(json.errors, null, 2));
        throw new Error(`Railway API Error: ${json.errors[0].message}`);
      }

      return json.data;
    } catch (error) {
      console.error('❌ Railway API Request Failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current user/team info
   */
  async getMe() {
    const query = `
      query {
        me {
          id
          name
          email
          teams {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query);
    return data.me;
  }

  /**
   * List all projects
   */
  async listProjects() {
    const query = `
      query {
        projects {
          edges {
            node {
              id
              name
              description
              createdAt
              services {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query);
    return data.projects.edges.map(e => e.node);
  }

  /**
   * Get project by name
   */
  async getProjectByName(projectName) {
    const projects = await this.listProjects();
    return projects.find(p => p.name === projectName);
  }

  /**
   * Create a new project
   */
  async createProject(name, description = '') {
    const query = `
      mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          id
          name
        }
      }
    `;

    const variables = {
      input: {
        name,
        description,
        prDeploys: false,
        prForks: false,
      },
    };

    const data = await this.query(query, variables);
    return data.projectCreate;
  }

  /**
   * Deploy service from GitHub repo
   */
  async deployFromGitHub(projectId, repo, branch = 'main', rootDirectory = null) {
    const query = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `;

    const variables = {
      input: {
        projectId,
        source: {
          repo,
          branch,
        },
        ...(rootDirectory && { rootDirectory }),
      },
    };

    const data = await this.query(query, variables);
    return data.serviceCreate;
  }

  /**
   * Set environment variables for a service
   */
  async setEnvironmentVariables(serviceId, variables) {
    const query = `
      mutation VariableCollectionUpsert($input: VariableCollectionUpsertInput!) {
        variableCollectionUpsert(input: $input)
      }
    `;

    const input = {
      input: {
        serviceId,
        variables,
      },
    };

    await this.query(query, input);
    return true;
  }

  /**
   * Get service deployments
   */
  async getDeployments(serviceId, limit = 10) {
    const query = `
      query ServiceDeployments($serviceId: String!, $first: Int) {
        service(id: $serviceId) {
          deployments(first: $first) {
            edges {
              node {
                id
                status
                createdAt
                staticUrl
                url
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, { serviceId, first: limit });
    return data.service.deployments.edges.map(e => e.node);
  }

  /**
   * Get deployment logs
   */
  async getDeploymentLogs(deploymentId, limit = 100) {
    const query = `
      query DeploymentLogs($deploymentId: String!, $limit: Int) {
        deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
          timestamp
          message
          severity
        }
      }
    `;

    const data = await this.query(query, { deploymentId, limit });
    return data.deploymentLogs;
  }

  /**
   * Get service domains
   */
  async getServiceDomains(serviceId) {
    const query = `
      query ServiceDomains($serviceId: String!) {
        service(id: $serviceId) {
          domains {
            id
            domain
          }
        }
      }
    `;

    const data = await this.query(query, { serviceId });
    return data.service.domains;
  }

  /**
   * Create a domain for service
   */
  async createServiceDomain(serviceId) {
    const query = `
      mutation ServiceDomainCreate($input: ServiceDomainCreateInput!) {
        serviceDomainCreate(input: $input) {
          id
          domain
        }
      }
    `;

    const variables = {
      input: {
        serviceId,
      },
    };

    const data = await this.query(query, variables);
    return data.serviceDomainCreate;
  }

  /**
   * Get service metrics (CPU, Memory, Network)
   */
  async getServiceMetrics(serviceId) {
    const query = `
      query ServiceMetrics($serviceId: String!) {
        service(id: $serviceId) {
          id
          name
          deployments(first: 1) {
            edges {
              node {
                id
                status
                staticUrl
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, { serviceId });
    return data.service;
  }

  /**
   * Redeploy service (trigger new deployment)
   */
  async redeployService(serviceId) {
    const query = `
      mutation ServiceInstanceRedeploy($serviceId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId)
      }
    `;

    const data = await this.query(query, { serviceId });
    return data.serviceInstanceRedeploy;
  }

  /**
   * Delete a service
   */
  async deleteService(serviceId) {
    const query = `
      mutation ServiceDelete($id: String!) {
        serviceDelete(id: $id)
      }
    `;

    const data = await this.query(query, { id: serviceId });
    return data.serviceDelete;
  }

  /**
   * Get service by name in project
   */
  async getService(projectId, serviceName) {
    const query = `
      query Project($projectId: String!) {
        project(id: $projectId) {
          services {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, { projectId });
    const service = data.project.services.edges.find(e => e.node.name === serviceName);
    return service ? service.node : null;
  }
}
