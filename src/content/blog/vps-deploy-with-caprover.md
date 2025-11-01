---
author: Gabriel Carvalho
pubDatetime: 2024-10-28T21:47:46.329Z
title: "deploy series 01: deploy your containers with capRover."
slug: "deploy-series-caprover-container"
featured: true
tags:
  - python
  - fastapi
  - api
  - deploy
  - docker
  - vps
  - cloud
  - digital-ocean
  - deploy-series
description: "a easy way deploy your apis and websites with your domain"
---

Deploy series: in this first episode, we going to cover a basic deploy of docker containers using capRover, DigitalOcean Droplet (VPS) and cloudflare for our DNS.

Often when developing apis with fastapi, or many other frameworks, we need to deploy them. But this often comes with many difficulties, such as providing the correct environment for the project or even needing access to the VPS to edit the content.

To standardize this, more than just use Docker, we can utilize tools to manage our container environment; in this case, CapRover. So let’s dive into it.

## Table of contents

## requirements

- For this post, I assume that you already have a VPS instance ON, in this blog we going to use the digitalOcean droplets. You can feel free to test this tutorial in any online VPS provider, for the cheapest one, I recommend Contabo or Hetzner.
- We going to need a domain, you can buy a very cheap in [porkbun](https://porkbun.com). And for DNS management, cloudflare.
- Also, we going to use github ([repo link](https://github.com/gabszs/FastApi--Password-Generator)) for code versioning and docker for container build, so, I assume that you already have some knowledge on container/docker side.

## Deploy Context

Today, we can resume most of steps to run a application in basically:

1. A dns service for our domain, so the client send a request to domain, the request them is processed by a DNS service (Like cloudflare) and later redirect to server
2. The server receives the request from cloudflare, and them, process the request and return the request response
3. The response come back all the way out to client

So, as this context, we going to replicate this.

### Spin up Droplet (DigitalOcean VPS) with docker

1. Create an account (you can create in this [referral link](https://m.do.co/c/92bca1da1ad7)).
2. setup a droplet (choose the custom docker image for VPS OS), use this [documentation](https://app.tango.us/app/workflow/Setting-Up-a-Docker-Droplet-on-DigitalOcean-a093884a58144dab8b39c656406710d2) for it.
3. Copy the public IP of the droplet to later process.

### Domain and DNS

It is necessary to have a domain (site name) to associate our application in a basic setup, you can choose a domain marketplace and DNS manager preferably, but in this case, we use cloudflare DNS and porkbun, as it offers both tools in one.

1. Create a cloudflare account, and them transfer your domain’s DNS management to it.
2. Create the DNS record to proxy the requests to your server (please use a \*.domain, to allow capRover to create multiple deploys), and do not mark proxy option (we are going to use CapRover certificates), check [steps documentation](https://app.tango.us/app/workflow/Adding-a-DNS-Record-for-Subdomain-on-Cloudflare-111369d12915453d9c6c7f5eaf24bd50).

### install Dependencies

1. update the OS and open the ports

```bash
# update
sudo apt update && sudo apt upgrade

# open the ports
ufw allow 80,443,3000,996,7946,4789,2377/tcp; ufw allow 7946,4789,2377/udp;
```

2. Run capRover container (can take some minutes)

```bash
docker run -d -p 80:80 -p 443:443 -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock -v /captain:/captain -e ACCEPTED_TERMS=true caprover/caprover
```

3. Install nodejs and capRover CLI

```bash
# install nodejs
sudo apt install nodejs npm

# install caprover CLI
npm install -g caprover
```

## Config and deploy the app

### Config capRover server

1. to start the capRover config, type:

```bash
caprover serversetup
```

2. Type "Y":
   ![caprover serversetup](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*kyjYCXcyS7JUo8xw.png)

3. Type your droplet Public IP:
   ![ip pin](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*Wc97-DGcyNUeeyYI.png)

4. Type the DNS record that you created in cloudflare (without the "*."):
   ![domain](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*a1vypF6WDcSIKXIr.png)

5. Create a new password for capRover server:
   ![password setup](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*S53YmcIhbH-KcGWr.png)

6. Type a valid email for free TLS certificate, to late enable HTTPS:
   ![email](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*7i-APsDKqnksNe2o.png)

7. and finally, type the name for your caprover server (you can simply type capRover):
   ![server name](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*QTrMtb2uUSr11kyw.png)

8. Caprover will spin up the management server, and generate a public link for access:
   ![caprover link](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*HkXAJWFb9vPpwUWZ.jpeg)

### Create a new app

After getting the public management server URL, fallow these [Instructions](https://app.tango.us/app/workflow/Setting-Up-a-APP-in-capRover-373f60dd1afb45eeb0c7f050835da8ec) to create a simple app that we going to user in future container deployment.

> Caprover manages to hold many apps, so, you can deploy as many containers as you want. We have this app concept, an abstraction of the deployment environment, where you create a new container, defines the port where its running, enable https, websockets and manage de reverse proxy config, for this tutorial, we going to use a very simple app config.

### Clone the repo and Deploy the container

Finally, after all this steps we will deploy our container, so, basically, we will follow this simples instructions

> Notice, In this deployment, we’re using this [python web-api](https://github.com/gabszs/FastApi--Password-Generator), where we explore a lot of concepts such as asyncio and concurrent tasks (coroutines). You can check a very good content about in this [post](https://gabrielcarvalho.dev/posts/introduction-to-asyncio-gather/#context)

1. Clone the repo inside the VPS

```bash
# CLONE the repo
https://github.com/gabszs/FastApi--Password-Generator.git

# cd into the repo dir
cd FastApi--Password-Generator

```

2. After cd into directory, type:

```bash
caprover deploy
```

3. so, select you caprover instance where the container will be deployed (since we only configured one, you can check the only option)
   ![caprover instance](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*o2P9d5VTYQBq0uud.png)

4. Select an app to host the container, since we created a one called password, lets going to select the password
   ![app selection](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*1cnClAb7Z_JtWUPb.png)

5. Caprover will ask you about which branch to watch, select the default one, also, it will alert you that any files marked in gitignore will not be pulled into the server, than, type "Y"
   ![branch selection](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*t3z9FMkv9SAlnCZb.png)

6. Caprover will build the container, and them, deploy it into the your domain, in the end, it will display the final URL, where you can check your deployment
   ![Final URL](https://miro.medium.com/v2/resize:fit:1212/format:webp/0*mwo2-Xurzsx-z926.png)

## Conclusion

Congratulations, your container is deployed, and also, your server, so you can also deploy as many containers as you want.

For this Api, you can check the final result in this [link](https://password-svc.portfile.dev/docs)

Later, I'll post more content about container and apps deploy, tackling content and technologies such as portainer, kubernetes, rancher, argoCD (gitops), so stay in track to new posts.

And if you like the post, had any feedback or question, you can send me a message on [whatsapp](https://wa.me/5511947047830) or [email](mailto:gabrielcarvalho.workk@gmail.dev).

By [Gabriel Carvalho](https://www.linkedin.com/in/gabzsz/) <br/>
