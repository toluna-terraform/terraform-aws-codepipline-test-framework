module "test_framework" {
  source = "../../"
  app_name = "my_app"
  env_type = "non-prod"
  app_envs = ["my_env"]
  postman_collections = [
  {
    collection = "my_app.postman_collection.json"
    environment = "postman_environment.json"
  }
  ]
}