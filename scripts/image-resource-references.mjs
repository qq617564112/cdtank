/** Read image and resource references from the application's reachable modules. */
import {existsSync, readFileSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

var root = resolve(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url)));
var pending = [resolve(root, 'apps/web/src/main.ts'), resolve(root, 'apps/web/src/models/reference-hero/main.ts')];
var visited = new Set();
var patterns = new Set();
var localImages = new Set();
var imagesets = new Set();

/** Resolve local imports using the source extensions used by Vite. */
function moduleFile(path) {
  var candidates = [path, path + '.ts', path + '.tsx', path + '.js', path + '.json', path + '.css',
    resolve(path, 'index.ts'), resolve(path, 'index.tsx')];
  return candidates.find(candidate => existsSync(candidate) && extname(candidate));
}

/** Static fragments of a template or concatenation form a resource glob. */
function pattern(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map(span => '*' + span.literal.text).join('');
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return pattern(node.left) + pattern(node.right);
  }
  return '*';
}

/** A loop over fixed image names has a finite set of references. */
function choices(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isConditionalExpression(node)) return [...choices(node.whenTrue), ...choices(node.whenFalse)];
  if (ts.isIdentifier(node)) {
    for (var parent = node.parent; parent; parent = parent.parent) {
      if (ts.isForOfStatement(parent) && ts.isVariableDeclarationList(parent.initializer)
          && parent.initializer.declarations.some(declaration => declaration.name.getText() === node.text)
          && ts.isArrayLiteralExpression(parent.expression)) {
        return parent.expression.elements.flatMap(choices);
      }
    }
  }
  if (ts.isTemplateExpression(node)) {
    var values = [node.head.text];
    for (var span of node.templateSpans) {
      values = values.flatMap(value => choices(span.expression).map(choice => value + choice + span.literal.text));
    }
    return values;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return choices(node.left).flatMap(left => choices(node.right).map(right => left + right));
  }
  return ['*'];
}

function reference(value, file, local = false) {
  if (value.endsWith('.imageset')) imagesets.add(value.replace(/^\//, ''));
  if (!/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|json)$/i.test(value)) return;
  if (local || value.startsWith('./') || value.startsWith('../')) {
    var resolved = resolve(dirname(file), value);
    var sourceRoot = resolve(root, 'apps/web/src') + '/';
    if (resolved.startsWith(sourceRoot)) localImages.add('local-images/' + resolved.slice(sourceRoot.length));
    return;
  }
  patterns.add(value.replace(/^\//, ''));
}

while (pending.length) {
  var file = pending.pop();
  if (!file || visited.has(file) || !existsSync(file)) continue;
  visited.add(file);
  var content = readFileSync(file, 'utf8');
  if (extname(file) === '.css') {
    for (var match of content.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) reference(match[1], file);
    continue;
  }
  if (!['.ts', '.tsx', '.js'].includes(extname(file))) continue;
  var source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      var imported = node.moduleSpecifier.text;
      if (imported.startsWith('.')) {
        reference(imported, file, true);
        pending.push(moduleFile(resolve(dirname(file), imported)));
      }
    }
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier) {
      var exported = node.moduleSpecifier.text;
      if (exported.startsWith('.')) pending.push(moduleFile(resolve(dirname(file), exported)));
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      var dynamic = node.arguments[0].text;
      if (dynamic.startsWith('.')) pending.push(moduleFile(resolve(dirname(file), dynamic)));
    }
    if (ts.isNewExpression(node) && node.expression.getText(source) === 'URL' && node.arguments?.[0]) {
      reference(pattern(node.arguments[0]), file, true);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
        || ts.isTemplateExpression(node) || ts.isBinaryExpression(node)) {
      for (var value of choices(node)) reference(value, file);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

process.stdout.write(JSON.stringify({modules: [...visited].map(path => path.slice(root.length + 1)).sort(),
  patterns: [...patterns].sort(), localImages: [...localImages].sort(), imagesets: [...imagesets].sort()}));
