# Railway Bridge - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Access the Railway SDK Ingest Tool
1. **Log in to mahSpeccy**
2. **Navigate to Settings tab** (gear icon in navigation)
3. **Scroll down to "Railway SDK Ingest" section**

### Step 2: Ingest the Railway SDK
1. **Click "Ingest SDK" button**
   - This will fetch the complete Railway SDK from GitHub
   - Process takes ~30-60 seconds
   - Progress shown with loading spinner

2. **Wait for success message**
   - Green checkmark ✅ indicates completion
   - Metadata shows total items, files, and directories
   - Last ingestion timestamp displayed

### Step 3: Explore the SDK

#### Browse Tab
- **Navigate the file tree** on the left
- **Click any file** to view contents on the right
- **See file metadata** (path, size, SHA)
- **View full source code** for all TypeScript, JavaScript, GraphQL files

#### Search Tab
- **Enter search query** (e.g., "graphql", "deployment", "mutation")
- **Click Search** or press Enter
- **View results** with file paths and previews
- **Click result** to view full file contents

#### Stats Tab
- **View total file counts** (files, directories)
- **See total repository size** in MB
- **Review files by extension** (.ts, .js, .graphql, .md, etc.)
- **Identify key SDK components** by file type distribution

## 📖 What You'll Find

### GraphQL Schema Files
```
Search: ".graphql"
Result: Complete GraphQL schema definitions
Use: Understand Railway API structure
```

### TypeScript SDK Files
```
Search: ".ts"
Result: Type-safe SDK implementation
Use: Copy patterns for your implementation
```

### Mutation Examples
```
Search: "mutation"
Result: All GraphQL mutation examples
Use: Learn deployment automation patterns
```

### Type Definitions
```
Search: "types.ts"
Result: Complete TypeScript type definitions
Use: Import types for type-safe code
```

## 🎯 Common Use Cases

### 1. Understanding Deployment Flow
**Goal:** Learn how to deploy to Railway

**Steps:**
1. Search for "deploy"
2. Find `deploymentCreate` mutation
3. Review input parameters
4. Check type definitions
5. Implement in your code

### 2. Creating a Railway Project
**Goal:** Programmatically create Railway project

**Steps:**
1. Search for "projectCreate"
2. Find mutation in schema
3. Review required inputs
4. Find example usage in SDK
5. Adapt for mahSpeccy

### 3. Managing Environment Variables
**Goal:** Set environment variables via API

**Steps:**
1. Search for "environment"
2. Find `environmentCreate` mutation
3. Review variable management patterns
4. Find `variableUpsert` mutation
5. Implement variable sync

### 4. GitHub Integration
**Goal:** Connect GitHub repo to Railway

**Steps:**
1. Search for "github"
2. Find `githubRepoDeploy` mutation
3. Review authentication flow
4. Check repo connection patterns
5. Implement auto-deploy

## 🔧 Practical Examples

### Example 1: View Deployment Mutations
```typescript
// In Search Tab
Query: "deploymentCreate"

// Results will show:
- GraphQL schema definition
- TypeScript function wrapper
- Input type definitions
- Response type definitions
```

### Example 2: Find Type Definitions
```typescript
// In Search Tab
Query: "DeploymentCreateInput"

// Results will show:
interface DeploymentCreateInput {
  projectId: string;
  environmentId: string;
  serviceId: string;
  // ... more fields
}
```

### Example 3: Browse SDK Structure
```typescript
// In Browse Tab
Navigate to: src/
View: Directory structure
Find: operations/ directory
Click: deployment.ts
View: All deployment functions
```

## 📊 Understanding the Data

### Manifest Structure
```json
{
  "repository": "crisog/railway-sdk",
  "branch": "main",
  "timestamp": "2025-11-26T...",
  "totalItems": 150,
  "manifest": [
    {
      "type": "directory",
      "name": "src",
      "path": "src",
      "children": [
        {
          "type": "file",
          "name": "index.ts",
          "path": "src/index.ts",
          "size": 1024,
          "sha": "abc123...",
          "content": "// Full file content here",
          "preview": "// First 200 characters..."
        }
      ]
    }
  ]
}
```

### File Types Available
- `.ts` - TypeScript source files
- `.tsx` - TypeScript React files
- `.js` - JavaScript files
- `.graphql` - GraphQL schema/queries
- `.json` - Configuration files
- `.md` - Documentation files
- `.yml` - CI/CD configurations

## 🎓 Learning Path

### Beginner
1. **Browse the README.md** - Understand SDK purpose
2. **View package.json** - See dependencies
3. **Explore src/index.ts** - Main entry point
4. **Check types.ts** - Core type definitions

### Intermediate
1. **Study src/operations/** - All API operations
2. **Review GraphQL schemas** - API structure
3. **Analyze client.ts** - HTTP client implementation
4. **Check auth patterns** - Token management

### Advanced
1. **Deep dive into mutations** - Deployment automation
2. **Study error handling** - Robust implementation
3. **Review batch operations** - Performance optimization
4. **Analyze real-world examples** - Production patterns

## 🚨 Troubleshooting

### Issue: Ingestion fails
**Solution:**
- Check internet connection
- Verify Supabase Edge Functions are deployed
- Check browser console for errors
- Try again after a few seconds

### Issue: No search results
**Solution:**
- Ensure ingestion completed successfully
- Check search query spelling
- Try broader search terms
- Use file extensions (.ts, .graphql)

### Issue: File content not showing
**Solution:**
- File may be binary (images, etc.)
- File may be too large (>500 KB)
- Click "Reload Manifest" to refresh
- Check if preview is available

## 💡 Pro Tips

### Tip 1: Use File Extensions
```typescript
// Instead of:
Search: "deployment"

// Try:
Search: "deployment.ts"
Search: ".graphql"
```

### Tip 2: Browse Before Searching
- Get familiar with directory structure first
- Understand where different types of files live
- Use Browse tab for exploration
- Use Search tab for specific needs

### Tip 3: Combine Stats + Search
- Check Stats tab to see what file types exist
- Find most common extension
- Search by that extension
- Review all files of that type

### Tip 4: Save Important Files
- Copy file contents to your codebase
- Add comments with file path
- Reference SHA for version tracking
- Update when SDK changes

## 🎉 What's Next?

After exploring the SDK:

1. **Implement Railway Client**
   - Create `/railway-bridge/railway-client.ts`
   - Add type-safe mutation functions
   - Use patterns from SDK

2. **Create Deployment Functions**
   - Project creation
   - Service deployment
   - Environment management
   - Variable configuration

3. **Build UI Components**
   - One-click deploy button
   - Deployment status monitor
   - Environment variable manager
   - Logs viewer

4. **Deploy to Railway**
   - Use GraphQL API
   - Automate deployment flow
   - Monitor deployment status
   - Handle errors gracefully

## 📚 Additional Resources

- **Railway SDK GitHub:** https://github.com/crisog/railway-sdk
- **Railway API Docs:** https://railway.app/graphql
- **Railway Dashboard:** https://railway.app/dashboard
- **GraphQL Playground:** https://railway.app/graphql (requires auth)

## 🤝 Support

If you need help:
1. Check the ingestion logs (browser console)
2. Review error messages in UI
3. Consult Railway SDK documentation
4. Check Railway Bridge README.md

---

**Ready to start?** Head to **Settings → Railway SDK Ingest** and click **"Ingest SDK"**! 🚀
